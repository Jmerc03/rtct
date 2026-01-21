# Real-Time Cyber Threat Management

## Attack Visualization System

Attack ingestion, storage, streaming, and visualization subsystem for the RTCT2 capstone project.

---

## Overview

This repository implements the **Attack Visualization and Threat API subsystem** of the _Real-Time Cyber Threat Management (RTCT2)_ capstone project. The system is responsible for **receiving, storing, streaming, and visualizing cyber threat alerts** to support human operators within a **Kubernetes-based command-and-control (C2) environment**.

This repository does **not** implement threat detection or machine learning models. Instead, it is designed to **consume alerts produced by external detection components** and present them in a clear, real-time, operator-facing interface.

---

## System Role Within RTCT2

The RTCT2 project is composed of multiple subsystems that collectively detect, analyze, and respond to cyber threats targeting C2 systems. This repository represents the **operator-facing visualization layer** and the **central alert management interface**.

The Attack Visualization system serves as the bridge between:

- **Detection components** (cluster-level, edge-device, or physics-based), and
- **Human operators** responsible for monitoring and responding to threats.

It provides both **real-time situational awareness** and **historical context** to support informed decision-making.

---

## High-Level Architecture

At a conceptual level, the system follows this flow:

**Alert Producers → Threat API → Database → Operator Dashboard**

- Alerts are ingested through a detector-agnostic API
- Alerts are persisted for historical review
- Alerts are streamed to connected clients in real time
- Visualization is separated from detection logic to reduce system coupling
- Designed to minimize computational overhead on the C2 system

---

## Repository Structure

```text
k8s/               # Kubernetes manifests and deployment configuration
alert-generation/  # Simulated alert and traffic generators for testing
api/               # Threat API and alert persistence layer
dashboard/         # Operator-facing visualization dashboard
```
