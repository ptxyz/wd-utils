const { WDSConnection } = require('./_classes')

async function initConnection (cPath) {
  const c = WDSConnection.getConnectionFromPath(cPath)
  await c.productionCheck()
  return c
}

module.exports = {
  initConnection
}
