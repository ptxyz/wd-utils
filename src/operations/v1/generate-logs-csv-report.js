const yargs = require('yargs')

const core = require('../../lib')

const sh = require('string-hash')
const moment = require('moment')
const fill = require('fill-range')
const as = require('async')
const objectPath = require('object-path')

const createCsvWriter = require('csv-writer').createObjectCsvWriter

async function main (argv) {
  // get connection
  const conn = (await core.connection.initConnection(argv.connection))

  console.log('retrieving collection info')

  let mapping

  try {
    // generate mapped relationship
    mapping = (await core.wds.getDocumentIdFieldMap(conn, {
      mappedFields: argv.title_field,
      parallelLimit: argv.parallel_limit,
      chunkSize: argv.chunk_size,
      filter: '',
      idField: 'id'
    })).data[0]
  } catch (e) {
    throw new Error('unable to generate id field mapping')
  }

  console.log('retrieving logs')

  const hash = {}

  try {
    await as.mapLimit(core.wds.iterateLogs(conn,
      {
        start: argv.start,
        end: argv.end,
        batchSize: argv.batch_size,
        batchUnit: argv.batchUnit,
        filter: argv.filter
      }), argv.parallel_limit, async (f) => {
      const r = (await f()).data[0]
      for (const l of r.results) {
        core.helpers.addMappedDataToDocumentResults(mapping, l.document_results.results)
        if (argv.customer_id_only && !l.customer_id) {
          continue
        }
        const k = sh(l.natural_language_query.toLowerCase())
        hash[k] = generateHashData(hash[k], l, argv.title_field)
      }
    })
  } catch (e) {
    console.error(e.message)
    throw new Error('unable to generate CSV logs report')
  }

  console.log('processing data')

  // convert to array, sort by count, then latest timestamp, descending
  const sortedTableData = Object.values(hash).sort((a, b) => a.count === b.count ? b.latestTimestamp.valueOf() - a.latestTimestamp.valueOf() : b.count - a.count)

  // clean up objects in array, format as expected for CSV writer
  for (const r of sortedTableData) {
    for (let i = 0; i < r.results.length; i++) {
      const d = r.results[i]
      r[`doc_${i + 1}_title`] = d.title
      r[`doc_${i + 1}_id`] = d.id
      r[`doc_${i + 1}_collection`] = d.collection
      r[`doc_${i + 1}_confidence`] = d.confidence.toFixed(2)
    }
    r.latestTimestampStr = r.latestTimestamp.toISOString()
    delete r.results
  }

  const headers = [
    { id: 'natural_language_query', title: 'QUERY' },
    { id: 'count', title: 'COUNT' },
    { id: 'latestTimestampStr', title: 'LATEST_TIMESTAMP' }
  ]

  fill(1, 10, 1).map(v => {
    headers.push({ id: `doc_${v}_title`, title: `DOC_${v}_TITLE` })
    headers.push({ id: `doc_${v}_id`, title: `DOC_${v}_ID` })
    headers.push({ id: `doc_${v}_collection`, title: `DOC_${v}_COLLECTION` })
    headers.push({ id: `doc_${v}_confidence`, title: `DOC_${v}_CONFIDENCE` })
  })

  const csvWriter = createCsvWriter({
    path: argv.out,
    header: headers
  })

  if (!process.env.DRY_RUN) {
    await csvWriter.writeRecords(sortedTableData)
    console.log(`wrote CSV to ${argv.out}`)
  } else {
    core.helpers.logDryRunOperation('Write File', argv.out)
  }

  return new core.classes.Result(1, 0, 0, [])
}

// logic to merge in data from query
function generateHashData (current, replacement, titleField) {
  if (!current) current = {}
  // determine if this is the latest query
  const toUpdate = moment(replacement.created_timestamp) > moment((current.latestTimestamp || 0))
  const data = {
    natural_language_query: replacement.natural_language_query,
    latestTimestamp: toUpdate ? moment(replacement.created_timestamp) : moment((current.latestTimestamp || 0)),
    count: current.count ? current.count + 1 : 1,
    results: current.results || []
  }
  // no update needed
  if (!toUpdate) return data

  // otherwise, update the results
  data.results = replacement.document_results.results.map(v => {
    return {
      id: v.document_id,
      title: objectPath.get(v._mapping, titleField, 'N/A'),
      collection: v.collection_id,
      confidence: v.confidence || 0
    }
  }).sort((a, b) => b.confidence - a.confidence)

  return data
}

function getArgs () {
  return yargs
    .option('out', {
      alias: 'o',
      describe: 'path to write csv'
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .option('title_field', {
      alias: 't',
      describe: 'document field to use as description for output',
      default: 'extracted_metadata.filename'
    })
    .option('filter', {
      alias: 'f',
      describe: 'apply a filter to the logs query',
      filter: ''
    })
    .option('customer_id_only', {
      describe: 'only include results with customer ids (typically, real queries)',
      type: 'boolean',
      default: false
    })
    .option('parallel_limit', {
      alias: 'p',
      describe: 'parallel operations (default 15)',
      default: 15
    })
    .option('batch_size', {
      describe: 'logs will be retrieved in batches as specified per batch unit and batch value. Only needs to be modified if you anticipate that you will receive more than 10k queries in a given day. Decrease this batch range so that the number of queries in the period remains below 10k',
      default: '15'
    })
    .option('batch_unit', {
      describe: 'logs will be retrieved in batches as specified per batch unit and batch value. Only needs to be modified if you anticipate that you will receive more than 10k queries in a given day. Decrease this batch range so that the number of queries in the period remains below 10k',
      default: 'days'
    })
    .option('start', {
      alias: 's',
      describe: 'retrieve logs starting from this timestamp. Specified in ISO 8061 format ex: 2020-05-14T09:00:00.000-05:00. Defaults to 15 days ago'
    })
    .option('end', {
      alias: 'e',
      describe: 'retrieve logs starting from this timestamp. Specified in ISO 8061 format ex: 2020-05-14T09:00:00.000-05:00. Defaults to now'
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
