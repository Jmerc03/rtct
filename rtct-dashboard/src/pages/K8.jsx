import { useEffect, useState } from "react";
import { getHealth } from "../api";

export default function K8() {
  const [health, setHealth] = useState(null);
  const [err, setErr] = useState("");
  const [lastChecked, setLastChecked] = useState(null);
  const [pods, setPods] = useState([]);
  const [selectedPodNamespaces, setSelectedPodNamespaces] = useState([
    "rtct",
    "default",
  ]);
  const [allPodNamespaces, setAllPodNamespaces] = useState(false);
  const [podsNamespace, setPodsNamespace] = useState("");
  const [podsSummary, setPodsSummary] = useState(null);
  const [podsErr, setPodsErr] = useState("");
  const [podsLoading, setPodsLoading] = useState(false);
  const [showOnlyProblemPods, setShowOnlyProblemPods] = useState(false);

  const [deployments, setDeployments] = useState([]);
  const [deploymentsNamespace, setDeploymentsNamespace] = useState("");
  const [deploymentsSummary, setDeploymentsSummary] = useState(null);
  const [deploymentsErr, setDeploymentsErr] = useState("");
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);
  const [showOnlyProblemDeployments, setShowOnlyProblemDeployments] =
    useState(false);

  const [nodes, setNodes] = useState([]);
  const [nodesErr, setNodesErr] = useState("");
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesFetchedAt, setNodesFetchedAt] = useState(null);

  const [namespaces, setNamespaces] = useState([]);
  const [namespacesErr, setNamespacesErr] = useState("");
  const [namespacesLoading, setNamespacesLoading] = useState(false);
  const [namespacesFetchedAt, setNamespacesFetchedAt] = useState(null);

  async function load() {
    try {
      setErr("");
      const h = await getHealth();
      setHealth(h);
      setLastChecked(new Date());
    } catch (e) {
      setErr(e.message || "Failed to load health");
    }
  }

  async function loadPods() {
    try {
      setPodsErr("");
      setPodsLoading(true);
      const token = localStorage.getItem("token");
      const namespaceParam = allPodNamespaces
        ? "all"
        : selectedPodNamespaces.length > 0
          ? selectedPodNamespaces.join(",")
          : "rtct,default";

      const res = await fetch(
        `/api/k8s/pods?namespace=${encodeURIComponent(namespaceParam)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) throw new Error(`Failed to load pods: ${res.status}`);
      const data = await res.json();
      // Backend returns { namespace, summary, pods: [...] } or possibly { items: [...] } or an array; normalize
      const items = Array.isArray(data) ? data : data.pods || data.items || [];
      setPods(items);
      if (!Array.isArray(data)) {
        const nsValue = Array.isArray(data.namespace)
          ? data.namespace.join(", ")
          : data.namespace || "";
        setPodsNamespace(nsValue);
        setPodsSummary(data.summary || null);
      } else {
        setPodsNamespace("");
        setPodsSummary(null);
      }
    } catch (e) {
      setPodsErr(e.message || "Failed to load pods");
    } finally {
      setPodsLoading(false);
    }
  }

  async function loadDeployments() {
    try {
      setDeploymentsErr("");
      setDeploymentsLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/k8s/deployments", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Failed to load deployments: ${res.status}`);
      }
      const data = await res.json();
      // Backend returns { namespace, summary, deployments: [...] } or possibly { items: [...] } or an array; normalize
      const items = Array.isArray(data)
        ? data
        : data.deployments || data.items || [];
      setDeployments(items);
      if (!Array.isArray(data)) {
        setDeploymentsNamespace(data.namespace || "");
        setDeploymentsSummary(data.summary || null);
      } else {
        setDeploymentsNamespace("");
        setDeploymentsSummary(null);
      }
    } catch (e) {
      setDeploymentsErr(e.message || "Failed to load deployments");
    } finally {
      setDeploymentsLoading(false);
    }
  }

  async function loadNodes() {
    try {
      setNodesErr("");
      setNodesLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/k8s/nodes", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Failed to load nodes: ${res.status}`);
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.nodes || data.items || [];
      setNodes(items);
      if (!Array.isArray(data)) {
        setNodesFetchedAt(data.fetchedAt || null);
      } else {
        setNodesFetchedAt(null);
      }
    } catch (e) {
      setNodesErr(e.message || "Failed to load nodes");
    } finally {
      setNodesLoading(false);
    }
  }

  async function loadNamespaces() {
    try {
      setNamespacesErr("");
      setNamespacesLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/k8s/namespaces", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Failed to load namespaces: ${res.status}`);
      }
      const data = await res.json();
      const items = Array.isArray(data)
        ? data
        : data.namespaces || data.items || [];
      setNamespaces(items);
      if (!Array.isArray(data)) {
        setNamespacesFetchedAt(data.fetchedAt || null);
      } else {
        setNamespacesFetchedAt(null);
      }
    } catch (e) {
      setNamespacesErr(e.message || "Failed to load namespaces");
    } finally {
      setNamespacesLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadPods();
    loadDeployments();
    loadNodes();
    loadNamespaces();
    if (allPodNamespaces) {
      const allNames = namespaces.map((ns) => ns?.name || "").filter(Boolean);
      setSelectedPodNamespaces(allNames);
    }
    const id = setInterval(() => {
      loadPods();
      loadDeployments();
      loadNodes();
      loadNamespaces();
    }, 15000);
    return () => clearInterval(id);
  }, [allPodNamespaces, selectedPodNamespaces]);

  function handleToggleAllPodNamespaces(checked) {
    setAllPodNamespaces(checked);
    if (checked) {
      setSelectedPodNamespaces(
        namespaces.map((ns) => ns?.name || "").filter(Boolean),
      );
    }
  }

  function handleTogglePodNamespace(namespaceName, checked) {
    setSelectedPodNamespaces((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, namespaceName]));
      }
      return prev.filter((ns) => ns !== namespaceName);
    });
  }
  const nsResources = computeNamespaceResources(pods);

  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <h2>K8</h2>

      <div style={card}>
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <h3>Cluster Nodes</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={loadNodes} disabled={nodesLoading}>
                {nodesLoading ? "Loading…" : "Reload"}
              </button>
            </div>
          </div>
          {nodesErr && <p style={{ color: "#b00" }}>{nodesErr}</p>}
          {nodes.length === 0 && !nodesLoading ? (
            <p>No nodes found.</p>
          ) : (
            <>
              {nodesFetchedAt && (
                <p style={{ margin: "4px 0", fontSize: 12, color: "#555" }}>
                  Nodes: <b>{nodes.length}</b> — Last updated:{" "}
                  {new Date(nodesFetchedAt).toLocaleTimeString()}
                </p>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Name</th>
                      <th style={th}>Roles</th>
                      <th style={th}>Ready</th>
                      <th style={th}>Internal IP</th>
                      <th style={th}>Kubelet</th>
                      <th style={th}>OS Image</th>
                      <th style={th}>CPU (capacity)</th>
                      <th style={th}>CPU (allocatable)</th>
                      <th style={th}>Mem (capacity)</th>
                      <th style={th}>Mem (allocatable)</th>
                      <th style={th}>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((n) => {
                      const name = n?.name || "";
                      const created = n?.creationTimestamp
                        ? new Date(n.creationTimestamp)
                        : null;
                      const ageMs = created
                        ? Date.now() - created.getTime()
                        : 0;
                      const age = created ? humanDuration(ageMs) : "";
                      const roles = formatNodeRoles(n?.labels);
                      const internalIP = getNodeAddress(n, "InternalIP");
                      const kubelet = n?.nodeInfo?.kubeletVersion || "";
                      const osImage = n?.nodeInfo?.osImage || "";
                      const readyCond = Array.isArray(n?.conditions)
                        ? n.conditions.find((c) => c?.type === "Ready")
                        : null;
                      const ready = readyCond?.status === "True";
                      const readyText = ready
                        ? "Ready"
                        : readyCond?.reason || "NotReady";
                      const readyLevel = ready ? "ok" : "error";

                      const capacity = n?.capacity || {};
                      const alloc = n?.allocatable || {};
                      const capCpu = capacity.cpu
                        ? formatCpu(parseCpuQuantity(capacity.cpu))
                        : "—";
                      const allocCpu = alloc.cpu
                        ? formatCpu(parseCpuQuantity(alloc.cpu))
                        : "—";
                      const capMem = capacity.memory
                        ? formatBytes(parseMemoryQuantity(capacity.memory))
                        : "—";
                      const allocMem = alloc.memory
                        ? formatBytes(parseMemoryQuantity(alloc.memory))
                        : "—";

                      return (
                        <tr key={n?.uid || name}>
                          <td style={td}>
                            <code>{name}</code>
                          </td>
                          <td style={td}>{roles || "—"}</td>
                          <td
                            style={{
                              ...td,
                              color: statusColor(readyLevel),
                              fontWeight: ready ? "500" : "400",
                            }}
                            title={readyCond?.message || ""}
                          >
                            {readyText}
                          </td>
                          <td style={td}>{internalIP || "—"}</td>
                          <td style={td}>{kubelet || "—"}</td>
                          <td style={td}>{osImage || "—"}</td>
                          <td style={td}>{capCpu}</td>
                          <td style={td}>{allocCpu}</td>
                          <td style={td}>{capMem}</td>
                          <td style={td}>{allocMem}</td>
                          <td
                            style={td}
                            title={created?.toLocaleString?.() || ""}
                          >
                            {age}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <h3>Namespaces</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={loadNamespaces} disabled={namespacesLoading}>
                {namespacesLoading ? "Loading…" : "Reload"}
              </button>
            </div>
          </div>
          {namespacesErr && <p style={{ color: "#b00" }}>{namespacesErr}</p>}
          {namespaces.length === 0 && !namespacesLoading ? (
            <p>No namespaces found.</p>
          ) : (
            <>
              {namespacesFetchedAt && (
                <p style={{ margin: "4px 0", fontSize: 12, color: "#555" }}>
                  Namespaces: <b>{namespaces.length}</b> — Last updated:{" "}
                  {new Date(namespacesFetchedAt).toLocaleTimeString()}
                </p>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Name</th>
                      <th style={th}>Phase</th>
                      <th style={th}>Pods</th>
                      <th style={th}>Running</th>
                      <th style={th}>Age</th>
                      <th style={th}>Labels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {namespaces.map((ns) => {
                      const name = ns?.name || "";
                      const phase = ns?.phase || "";
                      const podCount =
                        typeof ns?.podCount === "number" ? ns.podCount : null;
                      const runningPods =
                        typeof ns?.runningPods === "number"
                          ? ns.runningPods
                          : null;
                      const created = ns?.creationTimestamp
                        ? new Date(ns.creationTimestamp)
                        : null;
                      const ageMs = created
                        ? Date.now() - created.getTime()
                        : 0;
                      const age = created ? humanDuration(ageMs) : "";
                      const labelsText = formatLabels(ns?.labels);

                      return (
                        <tr key={ns?.uid || name}>
                          <td style={td}>
                            <code>{name}</code>
                          </td>
                          <td style={{ ...td, color: phaseColor(phase) }}>
                            {phase || "—"}
                          </td>
                          <td style={td}>
                            {podCount !== null ? podCount : "—"}
                          </td>
                          <td style={td}>
                            {runningPods !== null ? runningPods : "—"}
                          </td>
                          <td
                            style={td}
                            title={created?.toLocaleString?.() || ""}
                          >
                            {age}
                          </td>
                          <td style={td} title={labelsText}>
                            {labelsText || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3>API / DB Health</h3>
          <button onClick={load}>Re-check</button>
        </div>
        {err && <p style={{ color: "#b00" }}>{err}</p>}
        {!health ? (
          <p>Loading…</p>
        ) : (
          <ul>
            <li>
              ok: <b>{String(health.ok)}</b>
            </li>
            <li>
              db: <b>{String(health.db)}</b>
            </li>
            <li>service: {health.service}</li>
            <li>
              time:{" "}
              {new Date(health.time).toLocaleString?.() || String(health.time)}
            </li>
            {lastChecked && (
              <li>checked: {lastChecked.toLocaleTimeString()}</li>
            )}
          </ul>
        )}
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h3>Cluster Pods</h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <label
              style={{
                fontSize: 12,
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <input
                type="checkbox"
                checked={allPodNamespaces}
                onChange={(e) => handleToggleAllPodNamespaces(e.target.checked)}
              />
              All namespaces
            </label>

            <div
              style={{
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minWidth: 220,
              }}
            >
              <span>Namespaces</span>
              <div
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 8,
                  background: allPodNamespaces ? "#f8f8f8" : "#fff",
                  maxHeight: 160,
                  overflowY: "auto",
                  display: "grid",
                  gap: 6,
                }}
              >
                {namespaces.length === 0 ? (
                  <span style={{ color: "#666" }}>
                    {namespacesLoading
                      ? "Loading namespaces…"
                      : "No namespaces"}
                  </span>
                ) : (
                  namespaces.map((ns) => {
                    const value = ns?.name || "";
                    const checked = selectedPodNamespaces.includes(value);
                    return (
                      <label
                        key={value}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            handleTogglePodNamespace(value, e.target.checked)
                          }
                          disabled={namespacesLoading}
                        />
                        <span>{value}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <button onClick={loadPods} disabled={podsLoading}>
              {podsLoading ? "Loading…" : "Reload"}
            </button>

            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={showOnlyProblemPods}
                onChange={(e) => setShowOnlyProblemPods(e.target.checked)}
                style={{ marginRight: 4 }}
              />
              Only show pods with issues
            </label>
          </div>
        </div>
        {podsSummary?.fetchedAt && (
          <p style={{ margin: "4px 0", fontSize: 12, color: "#555" }}>
            Pods: <b>{podsSummary.totalPods}</b> — Last updated:{" "}
            {new Date(podsSummary.fetchedAt).toLocaleTimeString()}
          </p>
        )}
        {(podsNamespace ||
          allPodNamespaces ||
          selectedPodNamespaces.length > 0) && (
          <p style={{ margin: "4px 0", fontSize: 12, color: "#555" }}>
            Namespace filter:{" "}
            <code>
              {allPodNamespaces
                ? "all"
                : podsNamespace || selectedPodNamespaces.join(", ")}
            </code>
            {podsSummary && (
              <>
                {" "}
                — Pods: <b>{podsSummary.totalPods}</b>, Containers:{" "}
                <b>{podsSummary.totalContainers}</b>, Ready pods:{" "}
                <b>{podsSummary.readyPods}</b>, Restarts:{" "}
                <b>{podsSummary.totalRestarts}</b>
                {podsSummary.byPhase && (
                  <>
                    {" "}
                    — Phases:{" "}
                    {Object.entries(podsSummary.byPhase)
                      .map(([phase, count]) => `${phase}:${count}`)
                      .join(", ")}
                  </>
                )}
              </>
            )}
            {(nsResources.cpuReq ||
              nsResources.cpuLim ||
              nsResources.memReq ||
              nsResources.memLim) && (
              <>
                {" "}
                — CPU req: <b>{formatCpu(nsResources.cpuReq)}</b>, CPU limit:{" "}
                <b>{formatCpu(nsResources.cpuLim)}</b>, Mem req:{" "}
                <b>{formatBytes(nsResources.memReq)}</b>, Mem limit:{" "}
                <b>{formatBytes(nsResources.memLim)}</b>
              </>
            )}
          </p>
        )}
        {podsErr && <p style={{ color: "#b00" }}>{podsErr}</p>}
        {(showOnlyProblemPods
          ? pods.filter(isProblemPod).length
          : pods.length) === 0 && !podsLoading ? (
          <p>No pods found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Namespace</th>
                  <th style={th}>Name</th>
                  <th style={th}>Phase</th>
                  <th style={th}>Status</th>
                  <th style={th}>Ready</th>
                  <th style={th}>Node</th>
                  <th style={th}>Pod IP</th>
                  <th style={th}>Containers</th>
                  <th style={th}>Images</th>
                  <th style={th}>CPU Req</th>
                  <th style={th}>CPU Limit</th>
                  <th style={th}>Mem Req</th>
                  <th style={th}>Mem Limit</th>
                  <th style={th}>Restarts</th>
                  <th style={th}>Last Restart Reason</th>
                  <th style={th}>Age</th>
                </tr>
              </thead>
              <tbody>
                {(showOnlyProblemPods ? pods.filter(isProblemPod) : pods).map(
                  (p) => {
                    const ns = p?.namespace || "";
                    const name = p?.name || "";
                    const phase = p?.phase || "";
                    const restarts =
                      typeof p?.restarts === "number" ? p.restarts : 0;
                    const podStatus = getPodStatus(p);
                    const created = p?.startTime ? new Date(p.startTime) : null;
                    const ageMs = created ? Date.now() - created.getTime() : 0;
                    const age = created ? humanDuration(ageMs) : "";
                    const node = p?.node || "";
                    const podIP = p?.podIP || "";
                    const ready = !!p?.ready;
                    const containerCount =
                      typeof p?.containerCount === "number"
                        ? p.containerCount
                        : Array.isArray(p?.containers)
                          ? p.containers.length
                          : 0;
                    const images = Array.isArray(p?.containers)
                      ? p.containers.map((c) => c?.image || "").filter(Boolean)
                      : [];
                    const imageText =
                      images.length > 0
                        ? images.map(shortImageName).join(", ")
                        : "—";
                    const restartReason =
                      p?.restartReason ||
                      (restarts > 0 ? "unknown (see pod events)" : "—");

                    const hostIP = p?.hostIP || "";
                    const readyReason = p?.readyReason || "";
                    const lastRestartAt = p?.lastRestartAt
                      ? new Date(p.lastRestartAt)
                      : null;
                    const lastRestartText = lastRestartAt
                      ? humanDuration(Date.now() - lastRestartAt.getTime())
                      : "";
                    const lastExitCode =
                      typeof p?.lastExitCode === "number"
                        ? p.lastExitCode
                        : null;

                    let cpuReqCores = 0;
                    let cpuLimCores = 0;
                    let memReqBytes = 0;
                    let memLimBytes = 0;

                    if (Array.isArray(p?.containers)) {
                      for (const c of p.containers) {
                        const res = c?.resources || {};
                        const req = res.requests || {};
                        const lim = res.limits || {};
                        cpuReqCores += parseCpuQuantity(req.cpu);
                        cpuLimCores += parseCpuQuantity(lim.cpu);
                        memReqBytes += parseMemoryQuantity(req.memory);
                        memLimBytes += parseMemoryQuantity(lim.memory);
                      }
                    }

                    return (
                      <tr key={p?.uid || `${ns}/${name}`}>
                        <td style={td}>{ns}</td>
                        <td style={td}>
                          <code>{name}</code>
                        </td>
                        <td style={{ ...td, color: phaseColor(phase) }}>
                          {phase}
                        </td>
                        <td
                          style={{
                            ...td,
                            color: statusColor(podStatus.level),
                            fontWeight:
                              podStatus.level === "ok" ? "500" : "400",
                          }}
                          title={
                            restartReason ||
                            readyReason ||
                            podStatus.label ||
                            ""
                          }
                        >
                          {podStatus.label}
                        </td>
                        <td
                          style={{
                            ...td,
                            color: ready ? "#0a0" : "#b00",
                            fontWeight: ready ? "500" : "400",
                          }}
                          title={
                            readyReason ||
                            (ready ? "Pod is Ready" : "Pod is not Ready")
                          }
                        >
                          {ready ? "Yes" : "No"}
                        </td>
                        <td style={td}>{node}</td>
                        <td
                          style={td}
                          title={hostIP ? `Node IP: ${hostIP}` : ""}
                        >
                          {podIP}
                        </td>
                        <td style={td}>{containerCount}</td>
                        <td style={td} title={images.join(", ")}>
                          {imageText}
                        </td>
                        <td style={td}>
                          {cpuReqCores > 0 ? formatCpu(cpuReqCores) : "—"}
                        </td>
                        <td style={td}>
                          {cpuLimCores > 0 ? formatCpu(cpuLimCores) : "—"}
                        </td>
                        <td style={td}>
                          {memReqBytes > 0 ? formatBytes(memReqBytes) : "—"}
                        </td>
                        <td style={td}>
                          {memLimBytes > 0 ? formatBytes(memLimBytes) : "—"}
                        </td>
                        <td style={td}>{restarts}</td>
                        <td
                          style={td}
                          title={
                            lastRestartAt
                              ? `Last restart at ${lastRestartAt.toLocaleString()}${
                                  lastExitCode !== null
                                    ? ` (exit code ${lastExitCode})`
                                    : ""
                                }`
                              : ""
                          }
                        >
                          {restartReason || (restarts > 0 ? "unknown" : "—")}
                          {lastRestartText
                            ? ` · ${lastRestartText} ago${
                                lastExitCode !== null
                                  ? ` (code ${lastExitCode})`
                                  : ""
                              }`
                            : lastExitCode !== null
                              ? ` (code ${lastExitCode})`
                              : ""}
                        </td>
                        <td
                          style={td}
                          title={created?.toLocaleString?.() || ""}
                        >
                          {age}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h3>Namespace Deployments</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={loadDeployments} disabled={deploymentsLoading}>
              {deploymentsLoading ? "Loading…" : "Reload"}
            </button>
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={showOnlyProblemDeployments}
                onChange={(e) =>
                  setShowOnlyProblemDeployments(e.target.checked)
                }
                style={{ marginRight: 4 }}
              />
              Only show deployments with issues
            </label>
          </div>
        </div>
        {deploymentsSummary?.fetchedAt && (
          <p style={{ margin: "4px 0", fontSize: 12, color: "#555" }}>
            Deployments: <b>{deploymentsSummary.totalDeployments}</b> — Last
            updated:{" "}
            {new Date(deploymentsSummary.fetchedAt).toLocaleTimeString()}
          </p>
        )}
        {deploymentsNamespace && (
          <p style={{ margin: "4px 0", fontSize: 12, color: "#555" }}>
            Namespace: <code>{deploymentsNamespace}</code>
            {deploymentsSummary && (
              <>
                {" "}
                — Deployments: <b>{deploymentsSummary.totalDeployments}</b>,
                Replicas: <b>{deploymentsSummary.totalReplicas}</b>, Ready:{" "}
                <b>{deploymentsSummary.totalReadyReplicas}</b>, Available:{" "}
                <b>{deploymentsSummary.totalAvailableReplicas}</b>, Fully ready:{" "}
                <b>{deploymentsSummary.fullyReady}</b>, Partially ready:{" "}
                <b>{deploymentsSummary.partiallyReady}</b>, Not ready:{" "}
                <b>{deploymentsSummary.notReady}</b>
              </>
            )}
          </p>
        )}
        {deploymentsErr && <p style={{ color: "#b00" }}>{deploymentsErr}</p>}
        {(showOnlyProblemDeployments
          ? deployments.filter(isProblemDeployment).length
          : deployments.length) === 0 && !deploymentsLoading ? (
          <p>No deployments found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Namespace</th>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Replicas</th>
                  <th style={th}>Ready</th>
                  <th style={th}>Available</th>
                  <th style={th}>Images</th>
                  <th style={th}>Age</th>
                </tr>
              </thead>
              <tbody>
                {(showOnlyProblemDeployments
                  ? deployments.filter(isProblemDeployment)
                  : deployments
                ).map((d) => {
                  const ns = d?.namespace || "";
                  const name = d?.name || "";
                  const replicas =
                    typeof d?.replicas === "number" ? d.replicas : null;
                  const depStatus = getDeploymentStatus(d);
                  const readyReplicas =
                    typeof d?.readyReplicas === "number"
                      ? d.readyReplicas
                      : null;
                  const availableReplicas =
                    typeof d?.availableReplicas === "number"
                      ? d.availableReplicas
                      : null;
                  const created = d?.creationTimestamp
                    ? new Date(d.creationTimestamp)
                    : null;
                  const ageMs = created ? Date.now() - created.getTime() : 0;
                  const age = created ? humanDuration(ageMs) : "";
                  const images = Array.isArray(d?.images)
                    ? d.images
                    : Array.isArray(d?.containers)
                      ? d.containers.map((c) => c?.image || "").filter(Boolean)
                      : [];
                  const imageText =
                    images.length > 0
                      ? images.map(shortImageName).join(", ")
                      : "—";
                  const readyText =
                    readyReplicas !== null && replicas !== null
                      ? `${readyReplicas}/${replicas}`
                      : readyReplicas !== null
                        ? String(readyReplicas)
                        : "—";
                  const availableText =
                    availableReplicas !== null
                      ? String(availableReplicas)
                      : "—";

                  return (
                    <tr key={d?.uid || `${ns}/${name}`}>
                      <td style={td}>{ns}</td>
                      <td style={td}>
                        <code>{name}</code>
                      </td>
                      <td
                        style={{
                          ...td,
                          color: statusColor(depStatus.level),
                          fontWeight: depStatus.level === "ok" ? "500" : "400",
                        }}
                        title={depStatus.tooltip || ""}
                      >
                        {depStatus.label}
                      </td>
                      <td style={td}>{replicas !== null ? replicas : "—"}</td>
                      <td style={td}>{readyText}</td>
                      <td style={td}>{availableText}</td>
                      <td style={td} title={images.join(", ")}>
                        {imageText}
                      </td>
                      <td style={td} title={created?.toLocaleString?.() || ""}>
                        {age}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
const card = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
};

const th = {
  textAlign: "left",
  borderBottom: "1px solid #eee",
  padding: "8px",
};
const td = {
  borderBottom: "1px solid #f4f4f4",
  padding: "8px",
  verticalAlign: "top",
};

function humanDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function phaseColor(phase) {
  switch ((phase || "").toLowerCase()) {
    case "running":
      return "#0a0";
    case "pending":
      return "#a60";
    case "succeeded":
      return "#066";
    case "failed":
      return "#b00";
    case "unknown":
      return "#666";
    default:
      return "inherit";
  }
}

function shortImageName(image) {
  // Be defensive: handle non-strings or empty values gracefully
  if (!image || typeof image !== "string") return "";

  const trimmed = image.trim();
  if (!trimmed) return "";

  // Drop any digest (everything after "@")
  const [noDigest] = trimmed.split("@");

  // Separate tag from the rest (everything after the last ":")
  const lastColon = noDigest.lastIndexOf(":");
  let path = noDigest;
  let tag = "";

  if (lastColon > -1 && lastColon > noDigest.indexOf("/")) {
    path = noDigest.slice(0, lastColon);
    tag = noDigest.slice(lastColon + 1);
  }

  const parts = (path || "").split("/");
  const name = parts[parts.length - 1] || path || noDigest;

  return tag ? `${name}:${tag}` : name;
}

function parseCpuQuantity(q) {
  if (!q) return 0;
  const str = String(q).trim();
  if (!str) return 0;
  if (str.endsWith("m")) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : num / 1000; // millicores to cores
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseMemoryQuantity(q) {
  if (!q) return 0;
  const str = String(q).trim();
  if (!str) return 0;

  const units = [
    ["Ki", 1024],
    ["Mi", 1024 ** 2],
    ["Gi", 1024 ** 3],
    ["Ti", 1024 ** 4],
    ["Pi", 1024 ** 5],
    ["Ei", 1024 ** 6],
    ["K", 1000],
    ["M", 1000 ** 2],
    ["G", 1000 ** 3],
    ["T", 1000 ** 4],
    ["P", 1000 ** 5],
    ["E", 1000 ** 6],
  ];

  for (const [suffix, factor] of units) {
    if (str.endsWith(suffix)) {
      const num = parseFloat(str.slice(0, -suffix.length));
      return isNaN(num) ? 0 : num * factor;
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function formatCpu(cores) {
  if (!cores || !isFinite(cores)) return "0";
  if (cores < 1) {
    const m = Math.round(cores * 1000);
    return `${m}m`;
  }
  if (cores >= 10) {
    return `${Math.round(cores)}`;
  }
  return cores.toFixed(1);
}

function formatBytes(bytes) {
  if (!bytes || !isFinite(bytes)) return "0";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  if (val >= 10 || i === 0) {
    return `${Math.round(val)} ${units[i]}`;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function computeNamespaceResources(pods) {
  let cpuReq = 0;
  let cpuLim = 0;
  let memReq = 0;
  let memLim = 0;

  for (const p of pods || []) {
    if (!Array.isArray(p?.containers)) continue;
    for (const c of p.containers) {
      const res = c?.resources || {};
      const req = res.requests || {};
      const lim = res.limits || {};
      cpuReq += parseCpuQuantity(req.cpu);
      cpuLim += parseCpuQuantity(lim.cpu);
      memReq += parseMemoryQuantity(req.memory);
      memLim += parseMemoryQuantity(lim.memory);
    }
  }

  return { cpuReq, cpuLim, memReq, memLim };
}

// Helpers for pod/deployment statuses and filtering
function getPodStatus(p) {
  const phase = (p?.phase || "").toLowerCase();
  const ready = !!p?.ready;
  const restarts = typeof p?.restarts === "number" ? p.restarts : 0;
  const restartReason = p?.restartReason || "";
  const readyReason = p?.readyReason || "";

  if (!ready) {
    if (restartReason) {
      return {
        label: `Not ready (${restartReason})`,
        level: "error",
        tooltip: readyReason || restartReason,
      };
    }
    if (phase && phase !== "running" && phase !== "succeeded") {
      return {
        label: `Not ready (${phase})`,
        level: "error",
        tooltip: readyReason || "",
      };
    }
    return {
      label: "Not ready",
      level: "error",
      tooltip: readyReason || "",
    };
  }

  if (restarts > 0) {
    return {
      label: restartReason
        ? `Running (restarted · ${restartReason})`
        : `Running (restarted ${restarts}x)`,
      level: "warning",
      tooltip:
        readyReason ||
        (restartReason
          ? `Last restart reason: ${restartReason}`
          : `Pod has restarted ${restarts} time(s)`),
    };
  }

  return {
    label: "Healthy",
    level: "ok",
    tooltip: readyReason || "Pod is Ready",
  };
}

function isProblemPod(p) {
  const status = getPodStatus(p);
  return status.level !== "ok";
}

function getDeploymentStatus(d) {
  const replicas = typeof d?.replicas === "number" ? d.replicas : null;
  const readyReplicas =
    typeof d?.readyReplicas === "number" ? d.readyReplicas : null;
  const availableReplicas =
    typeof d?.availableReplicas === "number" ? d.availableReplicas : null;
  const updatedReplicas =
    typeof d?.updatedReplicas === "number" ? d.updatedReplicas : null;

  const conditions = Array.isArray(d?.conditions) ? d.conditions : [];
  const progressing = conditions.find((c) => c?.type === "Progressing");
  const availableCond = conditions.find((c) => c?.type === "Available");

  // Scaled down deployment
  if (replicas === 0) {
    return {
      label: "Scaled to 0",
      level: "ok",
      tooltip: "Deployment is scaled down to zero replicas",
    };
  }

  // Progress deadline exceeded => stuck rollout
  if (progressing?.reason === "ProgressDeadlineExceeded") {
    return {
      label: "Stuck (progress deadline exceeded)",
      level: "error",
      tooltip: progressing?.message || "Rollout did not complete in time",
    };
  }

  // Healthy: all requested replicas are ready and (optionally) available
  if (
    replicas !== null &&
    readyReplicas === replicas &&
    (availableReplicas === null || availableReplicas === replicas)
  ) {
    return {
      label: "Healthy",
      level: "ok",
      tooltip: "All replicas are ready and available",
    };
  }

  // Rolling out: updatedReplicas behind desired replicas
  if (
    updatedReplicas !== null &&
    replicas !== null &&
    updatedReplicas < replicas
  ) {
    return {
      label: `Rolling out (${updatedReplicas}/${replicas} updated)`,
      level: "warning",
      tooltip:
        progressing?.message ||
        "New ReplicaSet is still being rolled out to all replicas",
    };
  }

  // Degraded conditions based on ready/available counts
  if (replicas !== null && readyReplicas !== null && readyReplicas < replicas) {
    return {
      label: `Degraded (${readyReplicas}/${replicas} ready)`,
      level: "warning",
      tooltip: "Not all replicas are reported as ready",
    };
  }

  if (
    replicas !== null &&
    availableReplicas !== null &&
    availableReplicas < replicas
  ) {
    return {
      label: `Degraded (${availableReplicas}/${replicas} available)`,
      level: "warning",
      tooltip: "Not all replicas are reported as available",
    };
  }

  if (availableCond && availableCond.status === "False") {
    return {
      label: "Not available",
      level: "warning",
      tooltip: availableCond.message || "Deployment is marked as unavailable",
    };
  }

  return {
    label: "Unknown",
    level: "warning",
    tooltip: "",
  };
}

function isProblemDeployment(d) {
  const status = getDeploymentStatus(d);
  return status.level !== "ok";
}

function statusColor(level) {
  switch (level) {
    case "ok":
      return "#0a0";
    case "warning":
      return "#a60";
    case "error":
      return "#b00";
    default:
      return "inherit";
  }
}

function formatNodeRoles(labels) {
  if (!labels || typeof labels !== "object") return "";
  const entries = Object.keys(labels).filter((k) =>
    k.startsWith("node-role.kubernetes.io/"),
  );
  if (entries.length === 0) return "";
  return entries
    .map((k) => k.replace("node-role.kubernetes.io/", "") || "role")
    .join(", ");
}

function getNodeAddress(node, type) {
  const addrs = Array.isArray(node?.addresses)
    ? node.addresses
    : Array.isArray(node?.status?.addresses)
      ? node.status.addresses
      : [];
  const found = addrs.find((a) => a?.type === type);
  return found?.address || "";
}

function formatLabels(labels, max = 4) {
  if (!labels || typeof labels !== "object") return "";
  const parts = Object.entries(labels)
    .slice(0, max)
    .map(([k, v]) => `${k}=${v}`);
  const extra = Object.keys(labels).length - parts.length;
  if (extra > 0) {
    parts.push(`… +${extra} more`);
  }
  return parts.join(", ");
}
