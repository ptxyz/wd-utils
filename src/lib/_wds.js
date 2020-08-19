/*
All functions are async and return a Result object
*/
const { Result } = require('./_classes')
const { logDryRunOperation, generateParameters, getDocumentId } = require('./_helpers')
const fill = require('fill-range')
const as = require('async')
const mime = require('mime-types')
const _ = require('lodash')
const fs = require('fs')
const objectPath = require('object-path')
const path = require('path')

const CONST = require('./_const')

//
// -- CONTENTS --
//
// CREATE
// - createTrainingQuery
//
// READ
// - getCollectionInformation
// - getDocumentCount
// - getDocumentIdFieldMap
// - getNotices
// - getQueryResult
// - getTrainingData
// - getTrainingDataQuery
// - iterateDocuments
//
// UPDATE
// - upsertDocument
// - upsertJSONBackupDocument

// DESTROY
// - deleteDocument
// - deleteDocumentFromQuery
// - deleteTrainingData
//

//
// -- CREATE --
//

/**
 * Creates a training query
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} natural_language_query - natural language query for training query
 * @param {Object[]} examples - training query examples, per API spec
 * @param {String} filter - training query filter
 * @returns {Result}
 */
async function createTrainingQuery (conn, q) {
  const ret = new Result(0, 0, 0, [])
  const params = generateParameters({
    naturalLanguageQuery: q.natural_language_query,
    examples: q.examples.map(e => { return { document_id: e.document_id, collection_id: conn.data.collection_id, relevance: e.relevance, cross_reference: e.cross_reference } }),
    filter: q.filter,
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id
  }, conn)

  try {
    if (process.env.DRY_RUN) {
      logDryRunOperation('addTrainingData', params)
      return new Result(1, 0, 0, [params])
    }
    await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.addTrainingData(params))
    console.log(`accepted training data for query: ${q.natural_language_query}`)
    ret.successes++
    ret.data = [params]
  } catch (e) {
    if (e.statusText === 'Conflict') {
      console.log(`skipped training data for: ${q.natural_language_query}`)
      ret.skipped++
    } else {
      console.error(`failed for: ${q.natural_language_query}`)
      console.error(e.message)
      ret.failures++
    }
  }
  return ret
}

//
// -- READ --
//

/**
 * Returns collection information
 *
 * @param {WDSConnection} conn
 * @returns {Result}
 */
async function getCollectionInformation (conn) {
  // set up query
  const params = generateParameters({
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id
  }, conn)

  try {
    const r = (await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.getCollection(params))).result
    return new Result(1, 0, 0, [r])
  } catch (e) {
    console.error(e.message)
    throw new Error('failed to retrieve collection information')
  }
}

/**
 * Returns a count of documents in collection, optionally filtered
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} [options.filter] - Filter to apply
 * @returns {Result}
 */
async function getDocumentCount (conn, options) {
  options = _.defaults(options, {
    filter: CONST.DEFAULT_VALUES.FILTER
  })
  const params = generateParameters({
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id,
    count: 0,
    filter: options.filter,
    xWatsonLoggingOptOut: true
  }, conn)
  try {
    const r = (await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.query(params))).result
    return new Result(1, 0, 0, [r.matching_results])
  } catch (e) {
    console.error(e.message)
    throw new Error('Error retrieving document count')
  }
}

/**
 * Returns a count of documents in collection, optionally filtered
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} [options.filter] - Filter to apply
 * @param {String} [options.chunkSize] - Chunk size to use for batching
 * @param {String} [options.mappedFields] - Field to map to ID
 * @param {String} [options.parallelLimit] - Number of parallel operations
 * @returns {Result}
 */
async function getDocumentIdFieldMap (conn, options) {
  options = _.defaults(options, {
    filter: CONST.DEFAULT_VALUES.FILTER,
    mappedFields: CONST.DEFAULT_VALUES.MAPPED_FIELDS,
    chunkSize: CONST.DEFAULT_VALUES.CHUNK_SIZE,
    parallelLimit: CONST.DEFAULT_VALUES.PARALLEL_LIMIT
  })
  const map = {}
  let successes = 0
  let skipped = 0

  try {
    await as.mapLimit(iterateDocuments(conn, { filter: options.filter, chunkSize: options.chunkSize, _return: `id,document_id,${options.mappedFields},${options.idField}` }), options.parallelLimit, async (f) => {
      const r = await f()
      for (const d of r.data[0].results) {
        const id = options.idField ? objectPath.get(d, options.idField, false) : getDocumentId(d)
        if (!id) {
          skipped++
          continue
        }
        if (options.mappedFields.split(',').length > 1) {
          map[id] = {}
          for (const f of options.mappedFields.split(',')) {
            map[id][f.trim()] = objectPath.get(d, f.trim(), null)
          }
        } else {
          map[id] = objectPath.get(d, options.mappedFields, null)
        }
        successes++
      }
    })
  } catch (e) {
    console.error(e.message)
    throw new Error('unable to generate id field map')
  }
  return new Result(successes, 0, skipped, [map])
}

/**
 * Retrieves notices for a connection
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} options.filter - Optional filter to apply to query
 * @returns {Result}
 */
async function getNotices (conn, options) {
  options = _.defaults(options, {
    filter: CONST.DEFAULT_VALUES.FILTER
  })
  // set up query
  const params = generateParameters({
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id,
    filter: options.filter,
    count: 10000 // restricted to 10k
  }, conn)

  try {
    const r = (await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.queryNotices(params))).result.results
    return new Result(1, 0, 0, [r])
  } catch (e) {
    console.error(e.message)
    throw new Error('failed to retrieve notices data')
  }
}

/**
 * Returns a set of results from a query
 *
 * @param {WDSConnection} conn
 * @param {Object} options query parameters to apply
 * @returns {Result}
 */
async function getQueryResult (conn, options) {
  const params = generateParameters(
    Object.assign(
      options,
      {
        environmentId: conn.data.environment_id,
        collectionId: conn.data.collection_id,
        xWatsonLoggingOptOut: true
      }),
    conn)
  try {
    const r = (await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.query(params))).result
    return new Result(1, 0, 0, [r])
  } catch (e) {
    console.error(e.message)
    throw new Error('query failed')
  }
}

/**
 * Retrives Training Data
 *
 * @param {WDSConnection} conn
 * @returns {Result}
 */
async function getTrainingData (conn) {
  // set up query
  const params = generateParameters({
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id
  }, conn)

  // get training data
  try {
    const r = (await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.listTrainingData(params))).result
    return new Result(1, 0, 0, [r])
  } catch (e) {
    console.error(e.message)
    throw new Error('failed to download training data')
  }
}

/**
 * Get a single query from training data
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} options.queryId - Query ID
 * @returns {Result}
 */
async function getTrainingDataQuery (conn, options) {
  const params = generateParameters({
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id,
    queryId: options.queryId
  }, conn)
  try {
    const r = (await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.getTrainingData(params))).result
    return new Result(1, 0, 0, [r])
  } catch (e) {
    console.error(e.message)
    throw new Error('failed to retrieve training data query')
  }
}

/**
 * Iterate over all documents in a collection, optionally filtered.
 * Iterator will return a promise to query for a chunk of up to CHUNKSIZE
 * This iterator can be executed in parallel.
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} [options.filter] - Filter to apply
 * @param {String} [options.chunkSize] - Size of chunks to return
 * @yields {Promise} A promise to return the results of a
 *                   query for a given chunk of documents
 */
async function * iterateDocuments (conn, options) {
  options = _.defaults(options, {
    filter: CONST.DEFAULT_VALUES.FILTER,
    chunkSize: CONST.DEFAULT_VALUES.CHUNK_SIZE,
    _returns: false
  })
  const count = (await getDocumentCount(conn, {
    filter: options.filter
  })).data[0]

  console.log(`${count} documents match conditions`)

  const offsets = fill(0, count - 1, options.chunkSize)

  const funcs = offsets.map(v => async () => await getQueryResult(conn, {
    filter: options.filter,
    offset: v,
    count: options.chunkSize,
    _return: options._returns,
    sort: 'id,document_id'
  }))

  for (const f of funcs) {
    yield f
  }
}

//
// -- UPDATE --
//

/**
 * Upserts a file by path into a collection
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} options.path - path to file
 * @param {String} [options.id] - Document ID
 * @param {Object} [options.metadata] - Optional metadata
 * @returns {Result}
 */
async function upsertDocument (conn, options) {
  options = _.defaults(options, {
    metadata: CONST.DEFAULT_VALUES.METADATA
  })
  const ret = new Result(0, 0, 0, [])
  const params = generateParameters({
    documentId: options.id,
    file: fs.createReadStream(options.path),
    filename: path.basename(options.path),
    fileContentType: mime.lookup(options.path),
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id,
    metadata: JSON.stringify(options.metadata)
  }, conn)

  let mode = 'update'

  // if no id is specified, use the insert
  if (!options.id) {
    delete params.documentId
    mode = 'insert'
  }

  try {
    if (process.env.DRY_RUN) {
      params.file = options.path
      if (mode === 'update') logDryRunOperation('updateDocument', params)
      if (mode === 'insert') logDryRunOperation('insertDocument', params)
      return new Result(1, 0, 0, [params])
    }
    const r = await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => { return mode === 'update' ? conn.d.updateDocument(params) : conn.d.addDocument(params) })
    const id = params.documentId || r.result.document_id
    console.log(`upsert complete with document id: ${id || 'document'}`)
    ret.successes++
    ret.data = [{ documentId: id }]
  } catch (e) {
    console.error(e.message)
    console.error(`failed to upsert ${options.id}`)
    ret.failures++
  }
  return ret
}

/**
 * Upserts a JSON object into a collection
 *
 * @param {WDSConnection} conn
 * @param {options} options
 * @param {Object} options.document - Document
 * @param {String} options.id - Document ID
 * @returns {Result}
 */
async function upsertJSONBackupDocument (conn, options) {
  const ret = new Result(0, 0, 0, [])

  if (!options.id || !options.document) throw new Error('upsert JSON backup document requires id and document')

  const metadata = options.document.metadata

  // delete reserved fields
  delete options.document.metadata
  delete options.document.id
  delete options.document.document_id

  const params = generateParameters({
    documentId: options.id,
    file: Buffer.from(JSON.stringify(options.document)),
    fileContentType: 'application/json',
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id
  }, conn)
  if (objectPath.has('extracted_metadata.filename')) {
    params.filename = options.document.extracted_metadata.filename
  }
  if (metadata) {
    params.metadata = JSON.stringify(metadata)
  }
  try {
    if (process.env.DRY_RUN) {
      logDryRunOperation('updateDocument', params)
      return new Result(1, 0, 0, [params])
    }
    await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.updateDocument(params))
    console.log(`${options.id} upsert complete`)
    ret.successes++
    ret.data = [{ documentId: params.documentId }]
  } catch (e) {
    console.error(e.message)
    console.error(`failed to upsert ${options.id}`)
    ret.failures++
  }
  return ret
}

//
// -- DESTROY --
//

/**
 * Deletes Document by ID Data
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} options.documentId - document ID to remove
 * @returns {Result}
 */
async function deleteDocument (conn, options) {
  if (!options.documentId) {
    throw new Error('no document id specified for delete')
  }
  // set up query
  const params = generateParameters({
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id,
    documentId: options.documentId
  }, conn)

  try {
    if (process.env.DRY_RUN) {
      logDryRunOperation('deleteDocument', params)
      return new Result(1, 0, 0, [params])
    }
    await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.deleteDocument(params))
    console.log(`deleted ${options.documentId}`)
    return new Result(1, 0, 0, [params])
  } catch (e) {
    console.error(e.message)
    return new Result(0, 1, 0, [])
  }
}

/**
 * Remove a single document from a query's examples
 *
 * @param {WDSConnection} conn
 * @param {Object} options
 * @param {String} options.queryId - Query ID
 * @param {String} options.documentId - Document ID
 * @returns {Result}
 */
async function deleteDocumentFromQuery (conn, options) {
  const params = generateParameters({
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id,
    queryId: options.queryId,
    exampleId: options.documentId
  }, conn)
  try {
    if (process.env.DRY_RUN) {
      logDryRunOperation('deleteTrainingExample', params)
      return new Result(1, 0, 0, [params])
    }
    await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.deleteTrainingExample(params))
    console.log(`removed ${options.documentId} from ${options.queryId}`)
    return new Result(1, 0, 0, [params])
  } catch (e) {
    console.error(e.message)
    throw new Error('unable to remove document from query')
  }
}

/**
 * Deletes All Training Data
 *
 * @param {WDSConnection} conn
 * @returns {Result}
 */
async function deleteTrainingData (conn) {
  // set up query
  const params = generateParameters({
    environmentId: conn.data.environment_id,
    collectionId: conn.data.collection_id
  }, conn)

  try {
    if (process.env.DRY_RUN) {
      logDryRunOperation('deleteAllTrainingData', params)
      return new Result(1, 0, 0, [params])
    }
    await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d.deleteAllTrainingData(params))
    return new Result(1, 0, 0, [params])
  } catch (e) {
    console.error(e.message)
    throw new Error('failed to delete training data')
  }
}

module.exports = {
  createTrainingQuery,
  getCollectionInformation,
  getDocumentCount,
  getDocumentIdFieldMap,
  getNotices,
  getQueryResult,
  getTrainingData,
  getTrainingDataQuery,
  deleteDocument,
  deleteDocumentFromQuery,
  deleteTrainingData,
  upsertDocument,
  upsertJSONBackupDocument,
  iterateDocuments
}
