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
          (!filters.source || x.source === filters.source)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  get(id) {
    return alerts.find((x) => x.id === id);
  },
  update(id, patch) {
    const i = alerts.findIndex((x) => x.id === id);
    if (i < 0) return null;
    alerts[i] = { ...alerts[i], ...patch, updatedAt: new Date() };
    return alerts[i];
  },
  remove(id) {
    const i = alerts.findIndex((x) => x.id === id);
    if (i < 0) return false;
    alerts.splice(i, 1);
    return true;
  },
};
