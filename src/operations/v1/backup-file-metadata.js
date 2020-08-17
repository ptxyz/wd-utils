const yargs = require('yargs')
const objectPath = require('object-path')

const core = require('../../lib')

async function main (argv) {
  // get connection
  const conn = (await core.connection.initConnection(argv.connection))

  let mapping
  const metadataMap = {}

  try {
    mapping = (await core.wds.getDocumentIdFieldMap(conn, {
      mappedFields: 'id,document_id,metadata,segment_metadata,extracted_metadata,extracted_metadata.filename',
      parallelLimit: argv.parallel_limit,
      chunkSize: argv.chunk_size,
      filter: argv.filter,
      idField: 'extracted_metadata.sha1'
    })).data[0]
  } catch (e) {
    throw new Error('unable to generate id field mapping')
  }

  for (const m of Object.values(mapping)) {
    if (!metadataMap[m.extracted_metadata.filename]) metadataMap[m.extracted_metadata.filename] = []
    let id
    // if parent id field exists, this is the best indicator for document id
    if (objectPath.has(m, 'metadata.parent_document_id')) {
      id = m.metadata.parent_document_id
    // otherwise, with no segment metadata, there are no segments, and id can be used
    } else if (!m.segment_metadata) {
      id = m.id || m.document_id
    // otherwise, there is segment metadata and the parent id can be found there
    } else if (objectPath.has(m, 'segment_metadata.parent_id')) {
      id = m.segment_metadata.parent_id
    } else {
      console.warn(`unable to find correct id for ${m.extracted_metadata.filename}`)
    }
    // push the id and any metadata to object
    metadataMap[m.extracted_metadata.filename].push({
      id: id,
      metadata: m.metadata
    })
  }

  // check for duplicates (same filename, different SHA1)
  // user will need to remove incorrect values from output file
  // otherwise, the 0th index will be used by default
  const duplicates = Object.entries(metadataMap).filter(v => v[1].length > 1)

  if (duplicates.length > 0) {
    console.log('')
    console.log(`Conflicting metadata information found for: ${duplicates.map(v => v[0]).join(',')}`)
    console.log('Please review output file manually for these entries')
  }

  if (!process.env.DRY_RUN) {
    await core.helpers.writeObjectToFile(metadataMap, argv.out)
  } else {
    core.helpers.logDryRunOperation('Write File', argv.out)
  }

  return new core.classes.Result(1, 0, 0, [metadataMap])
}

function getArgs () {
  return yargs
    .option('out', {
      alias: 'o',
      describe: 'write metadata mapping to this file'
    })
    .option('connection', {
      alias: 'c',
      describe: 'WDS connection info JSON'
    })
    .option('filter', {
      alias: 'f',
      describe: 'Optionally apply a filter',
      default: ''
    })
    .option('chunk_size', {
      describe: 'Optionally, specify a specific batch size for document retrieval',
      default: 100
    })
    .option('dry_run', {
      alias: 'z',
      describe: 'dry run of operation',
      type: 'boolean',
      default: false
    })
    .option('parallel_limit', {
      alias: 'p',
      describe: 'parallel operations (default 15)',
      default: 15
    })
    .demandOption(['out', 'connection'], 'Requires an output file and WDS connection')
    .argv
}

module.exports = () => { core.execution.execute(main, getArgs()) }
