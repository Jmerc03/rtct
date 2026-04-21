const alerts = [];

module.exports = {
  create(a) {
    alerts.push(a);
    return a;
  },
  list(filters = {}) {
    return alerts
      .filter(
        (x) =>
          (!filters.status || x.status === filters.status) &&
          (!filters.severity || x.severity === filters.severity) &&
          (!filters.source || x.source === filters.source),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  listSources() {
    return Array.from(
      new Set(alerts.map((a) => a.source).filter(Boolean)),
    ).sort();
  },
  get(id) {
    return alerts.find((x) => x.id === id);
  },
  update(id, patch) {
    const i = alerts.findIndex((x) => x.id === id);
    if (i === -1) return null;

    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );

    alerts[i] = {
      ...alerts[i],
      ...cleanPatch,
      updatedAt: new Date(),
    };

    return alerts[i];
  },
  remove(id) {
    const i = alerts.findIndex((x) => x.id === id);
    if (i < 0) return false;
    alerts.splice(i, 1);
    return true;
  },
};
