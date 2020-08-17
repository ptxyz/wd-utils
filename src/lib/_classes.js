const yesno = require('yesno')
const DiscoveryV1 = require('ibm-watson/discovery/v1')
const DiscoveryV2 = require('ibm-watson/discovery/v2')
const { CloudPakForDataAuthenticator, IamAuthenticator } = require('ibm-watson/auth')
const { getMissingValues } = require('./_helpers')
const path = require('path')
const CONST = require('./_const.js')
/**
 * Standard class for passing results
 * @class Result
 *
 */

class Result {
  /**
   *Creates an instance of Result.
   * @param {Number} [successes=0] - Number of successes to report
   * @param {Number} [failures=0] - Number of failures to report
   * @param {Number} [skipped=0] - Number of skipped to report
   * @param {*} [data={}] - Any data payload
   * @memberof Result
   */
  constructor (successes, failures, skipped, data) {
    this.successes = successes || 0
    this.failures = failures || 0
    this.skipped = skipped || 0
    this.data = data || {}
  }

  /**
   * Combine two results, optionally overwrites data. Returns copy
   *
   * @param {Result} result - Result to combine
   * @param {*} [data] - Overwrite data with new value
   * @memberof Result
   */
  combine (result, data) {
    return new Result(
      this.successes + result.successes,
      this.failures + result.failures,
      this.skipped + result.skipped,
      (data || this.data)
    )
  }

  /**
   * Accumulates an array of results
   *
   * @static
   * @param {Results[]} results Array of Results
   * @returns {Result}
   * @memberof Result
   */
  static reduceResultSet (results) {
    return results.reduce((acc, v) => acc.combine(v, acc.data.concat(v.data)), new Result(0, 0, 0, []))
  }
}

/**
 * Connection information for a WDS connection
 *
 * @class Connection
 */
class WDSConnection {
  /**
   * Creates an instance of WDSConnection.
   * @param {Object} connectionData
   * @memberof WDSConnection
   */
  constructor (connectionData) {
    this.data = _validateConnectionData(connectionData)

    let authenticator
    if (this.data.authenticator === CONST.AUTHENTICATORS.iam) {
      authenticator = new IamAuthenticator({
        apikey: this.data.apikey
      })
    } else if (this.data.authenticator === CONST.AUTHENTICATORS.cpd) {
      authenticator = new CloudPakForDataAuthenticator({
        url: this.data.cluster_url,
        username: this.data.username,
        password: this.data.password,
        disableSslVerification: true
      })
    } else {
      throw new Error('invalid authenticator')
    }

    if (this.data.api_version === CONST.API_VERSIONS.v1 ||
    this.data.api_version === CONST.API_VERSIONS.v2) {
      this.d = new DiscoveryV1({
        version: this.data.version,
        authenticator: authenticator,
        url: this.data.url,
        disableSslVerification: true
      })
    }
    if (this.data.api_version === CONST.API_VERSIONS.v2) {
      this.d_v2 = new DiscoveryV2({
        disableSslVerification: true,
        authenticator: authenticator,
        version: this.data.version,
        url: this.data.url
      })
    }
    if (!this.d && !this.d_v2) {
      throw new Error('invalid API version')
    }
  }

  /**
   * Returns a WDS connection for a JSON connection file path
   *
   * @static
   * @param {String} cPath - Path to JSON connection file
   * @returns {WDSConnection} WDSConnection Object
   * @memberof WDSConnection
   */
  static getConnectionFromPath (cPath) {
    let c
    try {
      c = require(path.resolve(cPath))
    } catch (e) {
      throw new Error('unable to load connection file')
    }
    return new WDSConnection(c)
  }

  /**
   * Prompts the user to prceed if connection is marked as production
   *
   * @memberof WDSConnection
   */
  async productionCheck () {
    // confirm if connection is marked as production
    if (this.data.production === true) {
      const cont = await yesno({
        question: 'The specified connection is marked as production. Do you want to continue? (yN)',
        defaultValue: false
      })

      if (!cont) {
        console.log('exiting')
        process.exit()
      }
    }
  }

  /**
 * Prompts the user to prceed if connection is marked as production
 *
 * @memberof WDSConnection
 */
  async supportsVersion (version) {
    return this.data.api_version === version
  }
}

// validates that connection info contains correct fields
function _validateConnectionData (c) {
  const _mv = getMissingValues(['version', 'url', 'environment_id', 'collection_id', 'authenticator', 'api_version'], c)

  if (_mv.length > 0) {
    console.error(`connection is missing values: ${_mv.join(', ')}`)
    throw new Error('Invalid Connection')
  }
  return c
}

module.exports = {
  WDSConnection,
  Result
}
