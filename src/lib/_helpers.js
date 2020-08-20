const has = require('has-value')
const mkdirp = require('mkdirp')
const emptyDir = require('empty-dir')
const moment = require('moment')

const path = require('path')
const util = require('util')
const fs = require('fs')

// returns a list of missing required values
function getMissingValues (requiredFields, _root) {
  // reduce to only missing values
  return requiredFields.reduce((m, v) => has(_root, v) ? m : m.concat([v]), [])
}

function checkForMissingVariables (requiredFields, root) {
  const _mv = getMissingValues(requiredFields, root)
  if (_mv.length > 0) {
    console.error(`missing variables: ${_mv.join(', ')}`)
    throw new Error('required values not defined')
  }
}

async function writeObjectToFile (obj, path) {
  try {
    await mkdirpForFile(path)
    await util.promisify(fs.writeFile)(path, JSON.stringify(obj))
  } catch (e) {
    console.error(e.message)
    throw new Error('failed to write object as file')
  }
}

async function mkdirpForFile (_path) {
  await mkdirp(path.dirname(_path))
}

function logDryRunOperation (operation, params) {
  console.log(`Execute: ${operation} with parameters: ${util.inspect(params)}`)
}

function loadJSONFile (_path) {
  return require(path.resolve(_path))
}

function onlyUnique (v, i, s) {
  return s.indexOf(v) === i
}

function guaranteeEmptyDir (path) {
  mkdirp.sync(path)
  if (!emptyDir.sync(path)) {
    throw new Error('directory not empty')
  }
}

function assignTitlesToQueryResults (query, titleMap) {
  query.document_results.results = query.document_results.results.map(v => {
    return Object.assign(v, {
      title: titleMap[v.document_id] || 'NO MATCHED TITLE'
    })
  })
  return query
}

function generateParameters (params, connectionData) {
  if (!params._return) delete params._return
  if (!params.filter) delete params.filter
  if (!params.query) delete params.query
  if (!params.naturalLanguageQuery) delete params.naturalLanguageQuery
  return params
}

function lookupTrainingQueryFromJSON (trainingData, queryId) {
  return trainingData.queries.find(v => v.query_id === queryId) || {}
}

function lookupTrainingExampleFromJSON (query, documentId) {
  return query.examples.find(v => v.document_id === documentId) || {}
}

// returns an array of [{q: query, d: document}]
// used to identify matching documents inside a list of queries
function getMatchingQueriesAndExamples (td, document, includeSegments) {
  function isDocumentMatch (pattern, target, includeSegments) {
    const re = new RegExp(includeSegments ? `^${pattern}_*\\d*$` : `^${pattern}$`)
    return !!target.match(re)
  }

  const matchingQueries = []
  for (const q of td.queries) {
    for (const e of q.examples) {
      if (isDocumentMatch(document, e.document_id, includeSegments)) {
        matchingQueries.push({
          query: q,
          documentId: e.document_id
        })
      }
    }
  }

  return matchingQueries
}

function getDocumentId (doc) {
  return doc.id || doc.document_id
}

// returns an array of start and end dates in batches
function getDateRangeBatches (start, end, batchSize, batchUnit) {
  const ranges = []
  let i = moment(start)
  const to = moment(end)

  let next
  while (to > i) {
    next = moment(i).add(batchSize, batchUnit)
    // handle situations where the next batch is above the high limit
    if (next > to) {
      next = to
    }
    ranges.push({ start: i.utc().format(), end: next.utc().format() })
    i = next
  }

  return ranges
}

// adds mapped data to a result set
function addMappedDataToDocumentResults (mapping, results) {
  for (const d of results) {
    d._mapping = mapping[getDocumentId(d)] || {}
  }
}

module.exports = {
  checkForMissingVariables,
  mkdirpForFile,
  getMissingValues,
  writeObjectToFile,
  logDryRunOperation,
  loadJSONFile,
  onlyUnique,
  guaranteeEmptyDir,
  assignTitlesToQueryResults,
  generateParameters,
  lookupTrainingQueryFromJSON,
  lookupTrainingExampleFromJSON,
  getMatchingQueriesAndExamples,
  getDocumentId,
  getDateRangeBatches,
  addMappedDataToDocumentResults
}
