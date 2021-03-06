module.exports = {
  API_VERSIONS: {
    v1: 'v1',
    v2: 'v2'
  },
  AUTHENTICATORS: {
    iam: 'iam',
    cpd: 'cpd'
  },
  DEFAULT_VALUES: {
    PARALLEL_LIMIT: 1,
    FILTER: '',
    CHUNK_SIZE: 100,
    RETRY_INTERVAL: 1000,
    RETRY_ATTEMPTS: 5,
    MAPPED_FIELDS: 'title',
    METADATA: {},
    FORCE: false,
    LOGS: {
      START_DAYS_AGO: 30,
      BATCH_SIZE: 15,
      BATCH_UNIT: 'days',
      TITLE_FIELD: 'extracted_metadata.filename'
    }
  }
}
