const yargs = require('yargs')
const util = require('util')

const core = require('../../lib')

async function main (argv) {
  // get the connection
  const conn = await core.connection.initConnection(argv.connection)

  let options = {}

  if (argv.extra_params) {
    // merge in parameters
    for (const x of Array.isArray(argv.extra_params) ? argv.extra_params : [argv.extra_params]) {
      try {
        const set = x.split(':')
        options[set[0]] = set[1]
      } catch (e) {
        console.error(`unable to parse extra parameter: ${x}`)
        return new core.classes.Result(0, 1, 0, [])
      }
    }
  }

  // assign in values from argv
  options = Object.assign(options, {
    query: argv.is_nlq ? false : argv.query,
    naturalLanguageQuery: argv.is_nlq ? argv.query : false,
    filter: argv.filter,
    _return: argv.return
  })

  options = core.helpers.generateParameters(options, conn)

  const r = await core.wds.getQueryResult(conn, options)

  console.log(util.inspect(r.data[0], { depth: 8, maxArrayLength: Infinity, colors: true }))

  if (!process.env.DRY_RUN) {
    if (argv.out) {
      await core.helpers.writeObjectToFile(r.data[0], argv.out)
    }
  } else if (argv.out) {
    core.helpers.logDryRunOperation('Write File', argv.out)
  }

  return r
}

// TODO: maybe change the spceification for NLQ vs standard query
// TODO: add output file

function getArgs () {
  return yargs
    .option('filter', {
      alias: 'f',
      describe: 'filter to apply before deleting documents',
      default: ''
    })
    .option('query', {
      alias: 'q',
      describe: 'query to apply',
      default: ''
    })
    .option('return', {
      alias: 'r',
      describe: 'fields to return'
    })
    .option('is_nlq', {
      describe: 'query is a natural langauge query',
      type: 'boolean',
      default: true
    })
    .option('extra_params', {
      alias: 'x',
      describe: 'an extra parameter to include in NodeJS SDK request for WDS query API. Provided as key:value. For instance, count:5. Can be specified multiple times.'
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .demandOption(['connection'], 'Requires a WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
