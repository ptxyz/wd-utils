const yesno = require('yesno')
function devWrapper (f) {
  return async (...args) => {
    console.log(
`
******************************************************************
******************************************************************
**                                                              **
** This operation is in development and may change at any point **
**                                                              **
******************************************************************
******************************************************************
`
    )
    const acceptDev = await yesno({
      question: 'Would you like to continue with an operation that is currently in development? (yN)',
      defaultValue: false
    })
    if (!acceptDev) {
      console.log('exiting')
      process.exit(0)
    }
    f.apply(args)
  }
}

function listOperations () {
  console.log()
  console.log('Available Operations')
  console.log('--------------------')
  console.log()
  console.log(Object.keys(this).join('\n'))
}

module.exports = {
  'backup-documents-as-json': require('./v1/backup-documents-as-json'),
  'backup-file-metadata': require('./v1/backup-file-metadata'),
  'backup-training-data': require('./v1/backup-training-data'),
  'delete-document': require('./v1/delete-document'),
  'delete-training-data': require('./v1/delete-training-data'),
  'delete-documents-by-filter': require('./v1/delete-documents-by-filter'),
  'delete-documents-by-filter-v2': devWrapper(require('./v2/delete-documents-by-filter-v2')),
  'get-collection-information': require('./v1/get-collection-information'),
  'get-document-id-field-mapping': require('./v1/get-document-id-field-mapping'),
  'get-collection-notices': require('./v1/get-collection-notices'),
  'list-training-data-containing-document': require('./v1/list-training-data-containing-document'),
  'list-operations': listOperations,
  'query-collection': require('./v1/query-collection'),
  'remove-all-failed-examples-from-training-data': require('./v1/remove-all-failed-examples-from-training-data'),
  'remove-document-from-all-training-data': require('./v1/remove-document-from-all-training-data'),
  'remove-document-from-query': require('./v1/remove-document-from-query'),
  'replay-training-data': require('./v1/replay-training-data'),
  'replay-training-data-v2': devWrapper(require('./v2/replay-training-data-v2')),
  'upload-file': require('./v1/upload-file'),
  'upload-files-in-directory': require('./v1/upload-files-in-directory'),
  'upload-files-in-directory-v2': devWrapper(require('./v2/upload-files-in-directory-v2')),
  'upload-json-backups': require('./v1/upload-json-backups')
}
