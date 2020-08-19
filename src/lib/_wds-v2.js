/*
All functions are async and return a Result object
*/
const { Result } = require('./_classes')
const { logDryRunOperation, generateParameters } = require('./_helpers')
const CONST = require('./_const')

const _ = require('lodash')
const as = require('async')
const mime = require('mime-types')
const fs = require('fs')
const path = require('path')

// TODO: These need to be converted to be project centric instead of collection centric

//
// -- CONTENTS --
//
// CREATE
// - createTrainingQueryV2
//
// READ
// - getQueryResultV2
//
// UPDATE
// - upsertDocumentV2

// DESTROY
// - deleteDocumentV2
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
async function createTrainingQueryV2 (conn, q) {
  const ret = new Result(0, 0, 0, [])
  const params = generateParameters({
    naturalLanguageQuery: q.natural_language_query,
    examples: q.examples.map(e => { return { document_id: e.document_id, collection_id: (e.collection_id || conn.data.collection_id), relevance: e.relevance } }),
    filter: q.filter,
    projectId: conn.data.project_id || conn.data.environment_id
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
      }, async () => conn.d_v2.createTrainingQuery(params))
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
 * Returns a set of results from a query
 *
 * @param {WDSConnection} conn
 * @param {Object} options query parameters to apply
 * @returns {Result}
 */
async function getQueryResultV2 (conn, options) {
  const params = generateParameters(
    Object.assign(
      options,
      {
        projectId: conn.data.project_id,
        collectionIds: [conn.data.collection_id],
        xWatsonLoggingOptOut: true
      }),
    conn)
  try {
    console.log(params)
    console.log(conn.d_v2)
    const r = (await as.retry(
      {
        times: CONST.DEFAULT_VALUES.RETRY_ATTEMPTS,
        interval: CONST.DEFAULT_VALUES.RETRY_INTERVAL
      }, async () => conn.d_v2.query(params))).result
    return new Result(1, 0, 0, [r])
  } catch (e) {
    console.error(e.message)
    throw new Error('query failed')
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
async function upsertDocumentV2 (conn, options) {
  options = _.defaults(options, {
    metadata: CONST.DEFAULT_VALUES.METADATA,
    force: CONST.DEFAULT_VALUES.FORCE
  })
  const ret = new Result(0, 0, 0, [])
  const params = generateParameters({
    documentId: options.id,
    file: fs.createReadStream(options.path),
    filename: path.basename(options.path),
    fileContentType: mime.lookup(options.path),
    projectId: conn.data.project_id,
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
      }, async () => { return mode === 'update' ? conn.d_v2.updateDocument(params) : conn.d_v2.addDocument(params) })
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
async function deleteDocumentV2 (conn, options) {
  options = _.defaults(options, {
    xWatsonDiscoveryForce: CONST.DEFAULT_VALUES.FORCE
  })

  if (!options.documentId) {
    throw new Error('no document id specified for delete')
  }
  // set up query
  const params = generateParameters({
    projectId: conn.data.project_id,
    collectionId: conn.data.collection_id,
    documentId: options.documentId,
    xWatsonDiscoveryForce: options.force
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
      }, async () => conn.d_v2.deleteDocument(params))
    console.log(`deleted ${options.documentId}`)
    return new Result(1, 0, 0, [params])
  } catch (e) {
    console.error(e.message)
    return new Result(0, 1, 0, [])
  }
}

module.exports = {
  createTrainingQueryV2,
  getQueryResultV2,
  upsertDocumentV2,
  deleteDocumentV2
}
