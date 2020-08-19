# Watson Discovery Utilities

A collection of scripts to speed up some common tasks when working with Watson Discovery.

These are various operations that I have personally found useful while working with Watson Discovery.

These scripts are provided as is with no implied warranty. *Please use at your own risk.*

## Table of Contents
- [Watson Discovery Utilities](#watson-discovery-utilities)
  - [Table of Contents](#table-of-contents)
  - [Configurations](#configurations)
    - [Cloud Pak for Data and v2 APIs](#cloud-pak-for-data-and-v2-apis)
  - [Running a script](#running-a-script)
  - [Tips and Tricks](#tips-and-tricks)
    - [Use the dry run tag](#use-the-dry-run-tag)
    - [Replicate an existing collection](#replicate-an-existing-collection)
    - [Quickly upload a directory of documents and metadata](#quickly-upload-a-directory-of-documents-and-metadata)
    - [Delete all documents from a collection](#delete-all-documents-from-a-collection)
    - [Get a list of filenames and metadata in a collection](#get-a-list-of-filenames-and-metadata-in-a-collection)
    - [Move training data from one collection to another](#move-training-data-from-one-collection-to-another)
    - [Correcting errors in training data](#correcting-errors-in-training-data)
  - [Operations References](#operations-references)
    - [backup-documents-as-json](#backup-documents-as-json)
    - [backup-file-metadata](#backup-file-metadata)
    - [backup-training-data](#backup-training-data)
    - [delete-document](#delete-document)
    - [delete-training-data](#delete-training-data)
    - [delete-documents-by-filter](#delete-documents-by-filter)
    - [delete-documents-by-filter-v2](#delete-documents-by-filter-v2)
    - [get-document-id-field-mapping](#get-document-id-field-mapping)
    - [get-collection-information](#get-collection-information)
    - [get-collection-notices](#get-collection-notices)
    - [list-training-data-containing-document](#list-training-data-containing-document)
    - [query-collection](#query-collection)
    - [query-collection-v2](#query-collection-v2)
    - [remove-all-failed-examples-from-training-data](#remove-all-failed-examples-from-training-data)
    - [remove-document-from-all-training-data](#remove-document-from-all-training-data)
    - [remove-document-from-single-query](#remove-document-from-single-query)
    - [replay-training-data](#replay-training-data)
    - [replay-training-data-v2](#replay-training-data-v2)
    - [upload-file](#upload-file)
    - [upload-files-in-directory](#upload-files-in-directory)
    - [upload-files-in-directory-v2](#upload-files-in-directory-v2)
    - [upload-json-backups](#upload-json-backups)

## Configurations

These scripts use JSON configuration files to provide connection information. A sample configuration file is provided at [./sample-config.json](sample-config.json). Please modify this sample using the information for your Watson Discovery Instance.

```
{
  "version":"2019-04-30",
  "apikey": "",
  "url": "https://gateway.watsonplatform.net/discovery/api",
  "environment_id": "",
  "collection_id": "",
  "configuration_id": "",
  "production": false,
  "api_version": "v1",
  "authenticator": "iam"
}
```
These configuration files are referenced when executing scripts to set the target for the operation.

### Cloud Pak for Data and v2 APIs

**All v2 and Cloud Pak for Data scripts are currently in development**

**THE V2 CONFIGURATION FILES WILL CHANGE WITH SUBSEQUENT RELEASES!**

Currently, the only authenticators supported for these scripts are `iam` and `cpd` (Cloud Pak for Data)

To use these scripts with your Cloud Pak for Data instance of Discovery, the cpd authenticator requires the following values in the configuration.

```
{
  "username": "",
  "password": "",
  "cluster_url": ""
}
```

Cloud Pak for Data instances, as well as instances supporting the v2 APIs require a configuration with `api_version` set to `v2`

See [./sample-config-cpd.json](sample-config-cpd.json) and [./sample-config-v2.json](sample-config-v2.json) for sample configurations for cpd or v2.

## Running a script

First, install the dependencies using `npm install`

To execute a script, use the following command:

`npm run operation -- <operation name> [arguments]`

All available operations can be listed with

`npm run operation list-operations`

The `--help` tag can be used to display information about a command's arguments.

For example: `npm run operation -- backup-documents -c ./config/sandbox.json -d ./testing -z`

## Tips and Tricks

### Use the dry run tag

The dry run flag will output the operations that would have been executed, but will not modify the target collection. Use this to ensure that the operation will perform the tasks that you are expecting on the correct set of documents. 

The dry run flag is always `-z` 


### Replicate an existing collection

1. Ensure that you have a directory containing all of the original ingested files, with the original file names
2. Use `backup-file-metadata` to create a backup of all metadata for the original collection
3. Create a new collection
4. Use `upload-files-in-directory` with the `-m` argument to upload the original ingested files to the new collection using the existing metadata and ids
5. Adjust the collection configuration so that it is identical to the original collection configuration
6. Rerun step 4 to re-ingest the original files and apply any configuration changes
7. Validate the results

### Quickly upload a directory of documents and metadata

1. Use `upload-files-in-directory` with the `-m` argument pointing to a file containing metadata keyed on filename, as specified in the [`upload-files-in-directory` reference](###upload-files-in-directory)).
2. Documents may need to be reingested to reflect configuration changes to the collection

### Delete all documents from a collection

1. Use `delete-documents-by-filter` with no filter specified. **ALWAYS USE DRY RUN FIRST TO VALIDATE THE SET OF DOCUMENTS TO DELETE**

### Get a list of filenames and metadata in a collection 

1. Use `get-document-id-field-mapping` to generate a map using `-i extracted_metadata.filename` to use filename as the key, and `-m id,metadata` to include the document id and metadata
   1. Consider changing the mapped field depending on the specific configuration of your collection. For instance, if the collection is splitting documents, consider using `segment_metadata.parent_id`
   2. Be aware that the v2 APIs use a different schema, so the values may need to adjust depending on how the collection is configured or if the collection is on Cloud Pak for Data


### Move training data from one collection to another

1. Use `backup-training-data` to backup the training data in the source collection
2. Either upload the original documents with the preserved metadata (See: [Replicate a collection](###replicate-an-existing-collection)) to the target collection, (possibly deleting any existing documents) or modify the new training data file to replace the old id with the new id.
   1. If changing the training data, it can be useful to generate a map to link the old ids with the new ids. This can be done by generating a map using `get-document-id-field-mapping` and using a unique, "pinned" value as the key. For instance, `extracted_metadata.filename` could be used if the filenames are consistent between the collection
3. Use `replay-training-data` to replay the backed up (or modified) training data

### Correcting errors in training data
1. Use `remove-all-failed-examples-from-training-data` to automatically remove all examples from training data that has been reported as an error in the notices API
2. Alternatively, use a combination of `get-collection-notices`, `remove-document-from-all-training-data`, `remove-document-from-query`, and `list-training-data-containing-document` to work with more precision to correct errors.
   1. When using `get-collection-notices`, the notices can be limited using the filter argument. For instance, it can be limited to only notices about missing document ids with `-f "notices.notice_id::missing_document_id"`

## Operations References

### backup-documents-as-json

Download all documents as JSON formats from a collection and write the documents to a local directory.
Note that this **does not** download the original document, just the JSON representation

```
backup-documents-as-json
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --documents_path, -d  write training data to this directory         [required]
  --connection, -c      WDS connection info JSON                      [required]
  --filter, -f          Optionally apply a filter                  [default: ""]
  --chunk_size          Optionally, specify a specific batch size for document
                        retrieval                                 [default: 100]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
```

Example: `npm run operation -- backup-documents-as-json -c ./config/sandbox.json -d ./testing`

### backup-file-metadata

Downloads all file metadata. Can be used to reupload the original file with the current document id and any associated metadata.

Produces an output in the form:

```
{
  "<original-file-name>": {
    "id": <id>,
    "metadata": <metadata>
  }
  ...
}
```

```
backup-file-metadata
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --out, -o             write metadata mapping to this file           [required]
  --connection, -c      WDS connection info JSON                      [required]
  --filter, -f          Optionally apply a filter                  [default: ""]
  --chunk_size          Optionally, specify a specific batch size for document
                        retrieval                                 [default: 100]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
```

Example: `npm run operation -- backup-file-metadata -c ./config/sandbox.json -o ./metadata.json`

### backup-training-data

Download all training data from a collection and write the document as a JSON file

```
backup-training-data
Options:
  --help            Show help                                          [boolean]
  --version         Show version number                                [boolean]
  --out, -o         write training data to this file                  [required]
  --connection, -c  WDS connection info JSON                          [required]
  --dry_run, -z     dry run of operation              [boolean] [default: false]
```

Example: `npm run operation -- backup-training-data -c ./config/sandbox.json -o test.json -z`

### delete-document

Deletes a document from a collection

```
delete-document
Options:
  --help             Show help                                         [boolean]
  --version          Show version number                               [boolean]
  --document_id, -d  document id to remove from all training examples [required]
  --dry_run, -z      dry run of operation             [boolean] [default: false]
  --connection, -c   WDS connection info JSON                         [required]
```

Example: `npm run operation -- delete-document -c ./config/sandbox.json -d 1 -o test.json -z`

### delete-training-data

Deletes all training data from a collection

```
delete-training-data
Options:
  --help            Show help                                          [boolean]
  --version         Show version number                                [boolean]
  --out, -o         write training data to this file                  [required]
  --connection, -c  WDS connection info JSON                          [required]
  --dry_run, -z     dry run of operation              [boolean] [default: false]
```

Example: `npm run operation -- delete-training-data -c ./config/sandbox.json -d 1 -o test.json -z`

### delete-documents-by-filter

Applies a filter and deletes all matching documents

```
delete-documents-by-filter
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --filter, -f          filter to apply before deleting documents. No input will
                        affect every document                      [default: ""]
  --documents_path, -d  backup deleted documents to this directory    [required]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
  --connection, -c      WDS connection info JSON                      [required]
  --chunk_size          Optionally, specify a specific batch size for document
                        retrieval                                 [default: 100]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
```

Example: `npm run operation -- delete-documents-by-filter -c ./config/sandbox.json -f "id::12345" -d ./backup-documents -z`

### delete-documents-by-filter-v2

**DEVELOPMENT**

Applies a filter and deletes all matching documents using v2 APIs

```
delete-documents-by-filter-v2
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --filter, -f          filter to apply before deleting documents. No input will
                        affect every document                      [default: ""]
  --documents_path, -d  backup deleted documents to this directory    [required]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
  --connection, -c      WDS connection info JSON                      [required]
  --chunk_size          Optionally, specify a specific batch size for document
                        retrieval                                 [default: 100]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
```

Example: `npm run operation -- delete-documents-by-filter-v2 -c ./config/sandbox.json -f "id::12345" -d ./backup-documents -z`

### get-document-id-field-mapping

Produces a JSON document containing mapping information for a specified id field and any arbitrary field.

Produces an output in the form:

```
{
  "<id>": {
    "<mapped-field-1>": <value>,
    "<mapped-field-2>": <value>
  }
  ...
}
```

or if a single mapped field is specified

```
{
  "<id>": <mapped-field-value>
  ...
}
```

```
get-document-id-field-mapping
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --connection, -c      WDS connection info JSON                      [required]
  --out, -o             write training data to this file
  --mapped_fields, -m   document fields to map id to, comma separated
                                                              [default: "title"]
  --filter, -f          Optionally apply a filter                  [default: ""]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
  --id_field, -i        field to use as id. Defaults to empty string, which will
                        use id or document_id                      [default: ""]
  --chunk_size          Optionally, specify a specific batch size for document
                        retrieval                                 [default: 100]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
```

Example: `npm run operation -- get-document-id-field-mapping -c ./config/sandbox.json -i "id" -m "extracted_metadata.filename"`

In this example, the ids will be reported in a single json document with their corresponding filename

### get-collection-information

Returns information about a collection. Optionally specify an output file to write data.

```
get-collection-information
Options:
  --help            Show help                                          [boolean]
  --version         Show version number                                [boolean]
  --connection, -c  WDS connection info JSON                          [required]
  --out, -o         write training data to this file
  --dry_run, -z     dry run of operation              [boolean] [default: false]
```

Example: `npm run operation -- get-collection-information -c ./config/sandbox.json -z`

### get-collection-notices

Returns all notices from a collection. Results may be filtered.

```
get-collection-notices
Options:
  --help            Show help                                          [boolean]
  --version         Show version number                                [boolean]
  --connection, -c  WDS connection info JSON                          [required]
  --out, -o         write notices to this file
  --filter, -f      apply a filter to query
  --dry_run, -z     dry run of operation              [boolean] [default: false]
```

Example: `npm run operation -- get-collection-notices -c ./config/sandbox.json -z`

### list-training-data-containing-document

Returns a report of all training data containing a document. By default, if the document id is a parent document, it will include all child segments. Results will contain the original query and the affected documents for each query, and can optionally be written to a report.

```
list-training-data-containing-document
Options:
  --help                  Show help                                    [boolean]
  --version               Show version number                          [boolean]
  --document_id, -d       document id to find in training examples    [required]
  --connection, -c        WDS connection info JSON                    [required]
  --report, -r            write affected training data to this file
  --include_segments, -s  include document and any associated segments
                                                       [boolean] [default: true]
  --dry_run, -z           dry run of operation        [boolean] [default: false]
```

Example: `npm run operation -- list-training-data-containing-document -c ./config/sandbox.json -d <document id> -r <optional report file>`

### query-collection

Queries a collection

```
query-collection
Options:
  --help              Show help                                        [boolean]
  --version           Show version number                              [boolean]
  --filter, -f        filter to apply before deleting documents    [default: ""]
  --query, -q         query to apply                               [default: ""]
  --return, -r        fields to return
  --out, -o           write results to this file
  --is_nlq            query is a natural langauge query[boolean] [default: true]
  --extra_params, -x  an extra parameter to include in NodeJS SDK
                      request for WDS query API. Provided as key:value. For
                      instance, count:5. Can be specified multiple times.
  --dry_run, -z       dry run of operation            [boolean] [default: false]
  --connection, -c    WDS connection info JSON                        [required]
```

Example: `npm run operation -- query-collection -c ./config/sandbox.json -q ducks -r id,text`


### query-collection-v2

**DEVELOPMENT**

Queries a collection using the v2 APIs

```
query-collection-v2
Options:
  --help              Show help                                        [boolean]
  --version           Show version number                              [boolean]
  --filter, -f        filter to apply before deleting documents    [default: ""]
  --query, -q         query to apply                               [default: ""]
  --return, -r        fields to return
  --out, -o           write results to this file
  --is_nlq            query is a natural langauge query[boolean] [default: true]
  --extra_params, -x  an extra parameter to include in NodeJS SDK request for
                      WDS query API. Provided as key:value. For instance,
                      count:5. Can be specified multiple times.
  --dry_run, -z       dry run of operation            [boolean] [default: false]
  --connection, -c    WDS connection info JSON                        [required]
```

Example: `npm run operation -- query-collection-v2 -c ./config/sandbox.json -q ducks -r id,text`


### remove-all-failed-examples-from-training-data

Iterates through all reported errors in training data. Removes references to documents that do not exist, or documents that are no longer returned by query. Will write a backup file before making changes.

```
remove-all-failed-examples-from-training-data
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --connection, -c      WDS connection info JSON                      [required]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
  --out, -o             write backup training data to this file       [required]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
```

Example: `npm run operation -- remove-all-failed-examples-from-training-data -c ./config/sandbox.json -o test.json -z`

### remove-document-from-all-training-data

Iterates through all training data examples and removes references to the document. Will write a backup file before making changes. Optionally, a report can be generated that will include information about the affected queries.

```
remove-document-from-all-training-data
Options:
  --help                  Show help                                    [boolean]
  --version               Show version number                          [boolean]
  --document_id, -d       document id to remove from all training examples
                                                                      [required]
  --connection, -c        WDS connection info JSON                    [required]
  --parallel_limit, -p    parallel operations (default 15)         [default: 15]
  --out, -o               write backup training data to this file     [required]
  --report, -r            write affected training data to this file
  --include_segments, -s  include document and any associated segments
                                                       [boolean] [default: true]
  --dry_run, -z           dry run of operation        [boolean] [default: false]
```

Example: `npm run operation -- remove-document-from-all-training-data -c ./config/sandbox.json -o test.json -d 1 -z`

### remove-document-from-single-query

Removes a reference to a single document from training data query

```
remove-document-from-single-query
Options:
  --help             Show help                                         [boolean]
  --version          Show version number                               [boolean]
  --document_id, -d  document id to remove from all training examples [required]
  --query_id, -q     targeted query id                                [required]
  --include_segments, -s  include document and any associated segments
                                                       [boolean] [default: true]
  --dry_run, -z      dry run of operation             [boolean] [default: false]
  --connection, -c   WDS connection info JSON                         [required]
```

Example: `npm run operation -- remove-document-from-single-query -c ./config/sandbox.json -p 20 -d 1 -q 1 -z`

### replay-training-data

Will replay training data generated by `backup-training-data`. Requires documents in collection to be identical to the source of the training data, including the document's id. This can leveraged with `backup-documents` and `upload-json-documents` to effectively move an entire collection and training data to a different instances

```
replay-training-data
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --training, -t        WDS training data to replay                   [required]
  --connection, -c      WDS connection info JSON                      [required]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
```

Example: `npm run operation -- replay-training-data -c ./config/sandbox.json -t test.json -z`

### replay-training-data-v2

**DEVELOPMENT**

Will replay training data generated by `backup-training-data` using v2 APIs. Requires documents in collection to be identical to the source of the training data, including the document's id. This can leveraged with `backup-documents` and `upload-json-documents` to effectively move an entire collection and training data to a different instances

```
replay-training-data
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --training, -t        WDS training data to replay                   [required]
  --connection, -c      WDS connection info JSON                      [required]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
```

Example: `npm run operation -- replay-training-data -c ./config/sandbox.json -t test.json -z`

### upload-file

Uploads a single file to a collection

```
upload-file
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --file, -f            document to upload                            [required]
  --connection, -c      WDS connection info JSON                      [required]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
  --id, -i              id to use for document
  --metadata, -m        optional metadata
  --dry_run, -z         dry run of operation          [boolean] [default: false]
```

Example: `npm run operation -- upload-file -f test.json -c ./config/sandbox -z -i abc12345 -m '{"class": "A"}' -z`

### upload-files-in-directory

Uploads all files in a specified directory. Metadata may be specified using the output file from `backup-file-metadata`, or it may be manually generated using the schema specified below. If a file does not have mapped metadata, or if the id field is not specified, the file will be uploaded and the id will be generated by the service.

```
{
  "<file-name>": {
    "id": <id>,
    "metadata": <metadata>
  }
  ...
}
```

```
upload-files-in-directory
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --documents_path, -d  directory containing JSON documents           [required]
  --connection, -c      WDS connection info JSON                      [required]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
  --mapping_file, -m    optionally load a mapping file generated with
                        "backup-file-metadata"
  --dry_run, -z         dry run of operation          [boolean] [default: false]
```

Example: `npm run operation -- upload-files-in-directory -c ./config/sandbox.json -d ./my-files -m ./metadata.json -z`

### upload-files-in-directory-v2

Uploads all files in a specified directory using the v2 APIs. Metadata may be specified using the output file from `backup-file-metadata`, or it may be manually generated using the schema specified below. If a file does not have mapped metadata, or if the id field is not specified, the file will be uploaded and the id will be generated by the service.

```
{
  "<file-name>": {
    "id": <id>,
    "metadata": <metadata>
  }
  ...
}
```

```
upload-files-in-directory-v2
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --documents_path, -d  directory containing JSON documents           [required]
  --connection, -c      WDS connection info JSON                      [required]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
  --mapping_file, -m    optionally load a mapping file generated with
                        "backup-file-metadata"
  --dry_run, -z         dry run of operation          [boolean] [default: false]
```

Example: `npm run operation -- upload-files-in-directory-v2 -c ./config/sandbox.json -d ./my-files -m ./metadata.json -z`

### upload-json-backups

Uploads a directory of JSON backups from `backup-documents-as-json`.

**This does not upload the original file, only the resulting JSON representation of the original file**

```
upload-json-backups
Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --documents_path, -d  directory containing JSON documents           [required]
  --connection, -c      WDS connection info JSON                      [required]
  --parallel_limit, -p  parallel operations (default 15)           [default: 15]
  --id_field, -i        id field in JSON document                [default: "id"]
  --dry_run, -z         dry run of operation          [boolean] [default: false]
```

Example: `npm run operation -- upload-json-backups -d testing -c ./config/sandbox -z`


