require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Routes & middleware
const alerts = require("./src/routes/alerts");
const stream = require("./src/routes/stream");
const health = require("./src/routes/health");
const config = require("./src/routes/config");
const authRoutes = require("./src/routes/auth");
const usersRoutes = require("./src/routes/users");
const requireAuth = require("./src/middleware/auth");
// const { createAlert } = require("./src/db/alerts.js");

// K8s client (for pods view)
const k8s = require("@kubernetes/client-node");

const app = express();
app.set("trust proxy", 1);

const bus = require("./src/bus");

console.log("🔥 BUILD 1 - hello from Jaxson");

const migrate = require("./src/db/migrate");
migrate()
  .then(() => console.log("DB migrated"))
  .catch((e) => {
    console.error("DB migration failed:", e);
    process.exit(1);
  });

const internalRepo =
  process.env.REPO === "sql"
    ? require("./src/repos/alerts-sql")
    : require("./src/repos/alerts-memory");
// ---- Security / Core middleware ----
// CORS removed — traffic is same-origin via Ingress (/api → rtct-api)
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// ---- Rate limiting for auth endpoints ----
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

// ---- K8s client init (in-cluster or local kubeconfig) ----
let k8sCoreApi = null;
function getCoreApi() {
  if (k8sCoreApi) return k8sCoreApi;
  const kc = new k8s.KubeConfig();
  try {
    // In cluster (Kubernetes)
    kc.loadFromCluster();
    console.log("[k8s] loaded in-cluster config");
  } catch (e) {
    // Local dev fallback
    kc.loadFromDefault();
    console.log("[k8s] loaded default kubeconfig");
  }
  k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
  return k8sCoreApi;
}

let k8sAppsApi = null;
function getAppsApi() {
  if (k8sAppsApi) return k8sAppsApi;
  const kc = new k8s.KubeConfig();
  try {
    // In cluster (Kubernetes)
    kc.loadFromCluster();
    console.log("[k8s apps] loaded in-cluster config");
  } catch (e) {
    // Local dev fallback
    kc.loadFromDefault();
    console.log("[k8s apps] loaded default kubeconfig");
  }
  k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
  return k8sAppsApi;
}

console.log("⚙️ Using repo:", process.env.REPO);

// ---- Routes ----
app.get("/", (_req, res) => res.send("RTCT Alert API running"));

// ---- Internal alert route (no JWT, but secured by shared secret) ----
const INTERNAL_TOKEN = process.env.INTERNAL_ALERT_TOKEN;

app.use("/internal", require("./routes/internal"));

// Internal-only alert injection endpoint.
// This bypasses JWT but is protected by a shared secret header.
// It creates a "normal" alert row that looks just like those created by POST /alerts.
app.post("/internal/alert", express.json(), async (req, res) => {
  if (!INTERNAL_TOKEN || req.headers["x-internal-token"] !== INTERNAL_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { message, severity, source, type, confidence, data } = req.body || {};

  // Basic validation — require the same core fields as the public alerts route.
  if (!message) {
    return res.status(400).json({ error: "message required" });
  }

  try {
    const alert = {
      id: require("uuid").v4(),
      source: source || "alert-generator-pod",
      type: type || "system", // or "application" if you prefer
      severity: severity || "low",
      confidence:
        typeof confidence === "number"
          ? Math.max(0, Math.min(100, confidence))
          : 50,
      message,
      status: "new",
      data: data ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await internalRepo.create(alert);
    const saved = alert;

    // Reuse the same bus event as normal alerts so the SSE stream sees them.
    try {
      bus.broadcast("alert.new", saved);
    } catch (e) {
      console.warn(
        "[internal-alert] failed to broadcast on bus:",
        e.message || e,
      );
    }

    console.log("[internal-alert] saved:", saved.id);

    res.status(201).json(saved);
  } catch (err) {
    console.error("[internal-alert] failed to save:", err);
    res.status(500).json({ error: "failed_to_save_alert" });
  }
});

// Public
app.use("/auth", authLimiter, authRoutes);
app.use("/health", health);

// K8s: list pods in a single namespace (rtct by default)
app.get(
  ["/k8/pods", "/k8s/pods"],
  requireAuth.withRole("operator"),
  async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      // Namespace to query: use env if provided, otherwise default to the rtct namespace
      const ns = process.env.K8S_NS || "rtct";

      const api = getCoreApi();

      // Use namespaced pod listing so RBAC can stay namespace-scoped.
      // The client returns an object that may have a `body` property, or
      // may already be the response body, so normalize it here.
      const resp = await api.listNamespacedPod({ namespace: ns });
      const body = resp?.body || resp || {};

      const pods = (body.items || []).map((p) => {
        const nsActual = p?.metadata?.namespace || ns;
        const containerSpecs = p?.spec?.containers || [];
        const containerStatuses = p?.status?.containerStatuses || [];
        const conditions = p?.status?.conditions || [];

        const readyCond = conditions.find((c) => c.type === "Ready");
        const ready = readyCond?.status === "True";

        // Basic restart info from last terminated container state (if present)
        let restartReason = null;
        let lastRestartAt = null;
        let lastExitCode = null;

        for (const cs of containerStatuses) {
          const term = cs?.lastState?.terminated;
          if (term) {
            const finished = term.finishedAt ? new Date(term.finishedAt) : null;
            if (!lastRestartAt || (finished && finished > lastRestartAt)) {
              lastRestartAt = finished;
              restartReason = term.reason || null;
              lastExitCode =
                typeof term.exitCode === "number" ? term.exitCode : null;
            }
          }
        }

        return {
          uid: p?.metadata?.uid || null,
          name: p?.metadata?.name || "",
          namespace: nsActual,
          phase: p?.status?.phase || "",
          node: p?.spec?.nodeName || "",
          hostIP: p?.status?.hostIP || "",
          podIP: p?.status?.podIP || "",
          startTime: p?.status?.startTime || null,
          restarts: containerStatuses.reduce(
            (n, c) => n + (c?.restartCount || 0),
            0,
          ),
          containerCount: containerSpecs.length,
          ready,
          readyReason: readyCond?.reason || null,
          restartReason,
          lastRestartAt: lastRestartAt ? lastRestartAt.toISOString() : null,
          lastExitCode,
          containers: containerSpecs.map((c) => {
            const resources = c?.resources || {};
            const requests = resources.requests || {};
            const limits = resources.limits || {};
            return {
              name: c?.name || "",
              image: c?.image || "",
              resources: {
                requests: {
                  cpu: requests.cpu || null,
                  memory: requests.memory || null,
                },
                limits: {
                  cpu: limits.cpu || null,
                  memory: limits.memory || null,
                },
              },
            };
          }),
          conditions,
        };
      });

      const summary = pods.reduce(
        (acc, p) => {
          acc.totalPods += 1;
          acc.totalRestarts += typeof p.restarts === "number" ? p.restarts : 0;
          acc.totalContainers +=
            typeof p.containerCount === "number" ? p.containerCount : 0;
          if (p.ready) acc.readyPods += 1;
          const phase = (p.phase || "").toLowerCase();
          if (phase) {
            acc.byPhase[phase] = (acc.byPhase[phase] || 0) + 1;
          }
          return acc;
        },
        {
          totalPods: 0,
          totalRestarts: 0,
          totalContainers: 0,
          readyPods: 0,
          byPhase: {},
        },
      );

      res.json({
        namespace: ns,
        summary,
        pods,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[GET /k8/pods] error:", err?.response?.body || err);
      res.status(500).json({ error: "failed_to_list_pods" });
    }
  },
);

// K8s: list deployments in the same namespace
app.get(
  ["/k8/deployments", "/k8s/deployments"],
  requireAuth.withRole("operator"),
  async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const ns = process.env.K8S_NS || "rtct";
      const api = getAppsApi();

      const resp = await api.listNamespacedDeployment({ namespace: ns });
      const body = resp?.body || resp || {};

      const deployments = (body.items || []).map((d) => {
        const nsActual = d?.metadata?.namespace || ns;
        const spec = d?.spec || {};
        const status = d?.status || {};
        const containers =
          spec?.template?.spec?.containers &&
          Array.isArray(spec.template.spec.containers)
            ? spec.template.spec.containers
            : [];
        const images = containers
          .map((c) => (c?.image || "").trim())
          .filter(Boolean);

        return {
          uid: d?.metadata?.uid || null,
          name: d?.metadata?.name || "",
          namespace: nsActual,
          replicas: typeof spec?.replicas === "number" ? spec.replicas : null,
          availableReplicas:
            typeof status?.availableReplicas === "number"
              ? status.availableReplicas
              : null,
          readyReplicas:
            typeof status?.readyReplicas === "number"
              ? status.readyReplicas
              : null,
          updatedReplicas:
            typeof status?.updatedReplicas === "number"
              ? status.updatedReplicas
              : null,
          images,
          creationTimestamp: d?.metadata?.creationTimestamp || null,
          generation:
            typeof d?.metadata?.generation === "number"
              ? d.metadata.generation
              : null,
          observedGeneration:
            typeof status?.observedGeneration === "number"
              ? status.observedGeneration
              : null,
        };
      });

      const summary = deployments.reduce(
        (acc, d) => {
          acc.totalDeployments += 1;
          const replicas = typeof d.replicas === "number" ? d.replicas : 0;
          const ready =
            typeof d.readyReplicas === "number" ? d.readyReplicas : 0;
          const available =
            typeof d.availableReplicas === "number" ? d.availableReplicas : 0;
          acc.totalReplicas += replicas;
          acc.totalReadyReplicas += ready;
          acc.totalAvailableReplicas += available;
          if (ready === replicas && replicas > 0) {
            acc.fullyReady += 1;
          } else if (ready > 0 || available > 0) {
            acc.partiallyReady += 1;
          } else if (replicas > 0) {
            acc.notReady += 1;
          }
          return acc;
        },
        {
          totalDeployments: 0,
          totalReplicas: 0,
          totalReadyReplicas: 0,
          totalAvailableReplicas: 0,
          fullyReady: 0,
          partiallyReady: 0,
          notReady: 0,
        },
      );

      res.json({
        namespace: ns,
        summary,
        deployments,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[GET /k8/deployments] error:", err?.response?.body || err);
      res.status(500).json({ error: "failed_to_list_deployments" });
    }
  },
);

// K8s: list cluster nodes (cluster-scope, requires RBAC for nodes)
app.get(
  ["/k8/nodes", "/k8s/nodes"],
  requireAuth.withRole("operator"),
  async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const api = getCoreApi();

      const resp = await api.listNode();
      const body = resp?.body || resp || {};

      const nodes = (body.items || []).map((n) => {
        const status = n?.status || {};
        const nodeInfo = status?.nodeInfo || {};
        const conditions = status?.conditions || [];
        const addresses = status?.addresses || [];

        const readyCond = conditions.find((c) => c.type === "Ready");
        const ready = readyCond?.status === "True";

        const internalIPObj = addresses.find((a) => a.type === "InternalIP");
        const hostnameObj = addresses.find((a) => a.type === "Hostname");

        return {
          name: n?.metadata?.name || "",
          labels: n?.metadata?.labels || {},
          annotations: n?.metadata?.annotations || {},
          creationTimestamp: n?.metadata?.creationTimestamp || null,
          ready,
          readyReason: readyCond?.reason || null,
          readyMessage: readyCond?.message || null,
          capacity: status?.capacity || {},
          allocatable: status?.allocatable || {},
          internalIP: internalIPObj?.address || null,
          hostname: hostnameObj?.address || null,
          kubeletVersion: nodeInfo?.kubeletVersion || null,
          containerRuntimeVersion: nodeInfo?.containerRuntimeVersion || null,
          osImage: nodeInfo?.osImage || null,
          kernelVersion: nodeInfo?.kernelVersion || null,
          conditions,
        };
      });

      res.json({
        nodes,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[GET /k8/nodes] error:", err?.response?.body || err);
      res.status(500).json({ error: "failed_to_list_nodes" });
    }
  },
);

// K8s: list namespaces with lightweight pod counts
app.get(
  ["/k8/namespaces", "/k8s/namespaces"],
  requireAuth.withRole("operator"),
  async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const core = getCoreApi();

      // List all namespaces (cluster-scope)
      const resp = await core.listNamespace();
      const body = resp?.body || resp || {};
      const nsItems = body.items || [];

      const namespaces = [];

      for (const ns of nsItems) {
        const name = ns?.metadata?.name;
        let podCount = null;
        let runningPods = null;

        if (name) {
          try {
            const podsResp = await core.listNamespacedPod({ namespace: name });
            const podsBody = podsResp?.body || podsResp || {};
            const pods = podsBody.items || [];
            podCount = pods.length;
            runningPods = pods.filter(
              (p) => (p?.status?.phase || "").toLowerCase() === "running",
            ).length;
          } catch (e) {
            // If we fail to list pods in some namespaces due to RBAC,
            // just skip counts for that namespace and carry on.
            console.warn(
              `[k8s namespaces] failed to list pods for namespace ${name}:`,
              e?.response?.body || e?.message || e,
            );
          }
        }

        namespaces.push({
          name,
          phase: ns?.status?.phase || "",
          creationTimestamp: ns?.metadata?.creationTimestamp || null,
          labels: ns?.metadata?.labels || {},
          annotations: ns?.metadata?.annotations || {},
          podCount,
          runningPods,
        });
      }

      res.json({
        namespaces,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[GET /k8/namespaces] error:", err?.response?.body || err);
      res.status(500).json({ error: "failed_to_list_namespaces" });
    }
  },
);

// Protected (JWT)
app.use("/alerts", requireAuth, alerts);
app.use("/config", requireAuth, config);
app.use("/users", requireAuth, usersRoutes);

// SSE stream (secured in stream.js via ?token= or Authorization header)
app.use("/stream", stream);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
