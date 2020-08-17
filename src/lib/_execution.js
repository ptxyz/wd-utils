async function execute (f, argv) {
  try {
    initEnv(argv)
    const results = await f(argv)
    if (process.env.DRY_RUN) {
      console.log('\n' + `dry run complete. ${results.successes} operations would have been executed`)
    } else {
      console.log('\n' + `complete. ${results.successes} successes, ${results.skipped} skipped, ${results.failures} failures.`)
    }
  } catch (e) {
    console.error(e.message)
  }
}

function initEnv (argv) {
  if (!argv) {
    console.warn('arguments were not passed to execution function')
    return
  }
  if (argv.dry_run === true) {
    console.log('executing as dry run. no data will be changed')
    process.env.DRY_RUN = true
  }
}

module.exports = {
  execute
}
