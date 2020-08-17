const yargs = require('yargs')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = await core.connection.initConnection(argv.connection)
  // retrieve training data
  const res = await core.wds.getTrainingData(conn)
  // write training data (unless dry run)
  if (!process.env.DRY_RUN) {
    console.log('training data has been backed up to: ' + argv.out)
    await core.helpers.writeObjectToFile(res.data[0], argv.out)
  }

  return core.wds.deleteTrainingData(conn)
}

function getArgs () {
  return yargs
    .option('out', {
      alias: 'o',
      describe: 'write training data to this file'
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .demandOption(['out', 'connection'], 'Requires an output file and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
