const operations = require('./operations')

let operation
if (process.argv[2]) {
  operation = process.argv[2]
} else {
  console.error('no operation specified')
  process.exit(0)
}

if (!operations[operation]) {
  console.error(`${operation} is an unrecognized operation. see readme for available operations`)
  process.exit(0)
}

console.log(operation)
operations[operation]()
