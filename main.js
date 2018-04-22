var fs = require('fs')
var path = require('path')
var _ = require('lodash')
var zipper = require('zip-local')
var rimraf = require('rimraf')

var convert = require('xml-js')
var json2xls = require('json2xls')

var typeMap = {
   "bmi":"HKQuantityTypeIdentifierBodyMassIndex",
   // "height":"HKQuantityTypeIdentifierHeight",
   "weight":"HKQuantityTypeIdentifierBodyMass",
   "bodyFat":"HKQuantityTypeIdentifierBodyFatPercentage",
   "leanBodyMass":"HKQuantityTypeIdentifierLeanBodyMass"
   // "stepCount":"HKQuantityTypeIdentifierStepCount",
   // "sleep":"HKCategoryTypeIdentifierSleepAnalysis"
}

var EXPORT_PATH = './export/apple_health_export'
var EXPORT_FILE = 'export.xml'

var IMPORT_PATH = './import_files/'
var IMPORT_FILE = 'export.zip'

var DATA_FILE = 'fitnessData.xlsx'

if (fs.existsSync(path.join(EXPORT_PATH))) {
    rimraf.sync(path.join(EXPORT_PATH))
}

if (fs.existsSync(DATA_FILE)) {
    rimraf.sync(DATA_FILE)
}

fs.mkdirSync(path.join(EXPORT_PATH, '..'))
zipper.sync.unzip(path.join(IMPORT_PATH, IMPORT_FILE)).save(path.join(EXPORT_PATH, '..'));

var appleHealthXML = fs.readFileSync(path.join(EXPORT_PATH, EXPORT_FILE), 'utf8')
var appleHealthJSON = convert.xml2js(appleHealthXML, {
  ignoreComment: true,
  spaces: 4
  }
)

var healthDataIndex = 1
for (var i = 0; i < appleHealthJSON['elements'].length; i++) {
  if (appleHealthJSON['elements'][i].name === 'HealthData') {
    healthDataIndex = i
  }
}

var healthData = appleHealthJSON['elements'][healthDataIndex]['elements']
var formattedData = {}

for (var i = 0; i < healthData.length; i++) {
  let element = healthData[i].attributes

  let isType = false
  for (var type in typeMap) {
    if (element.type === typeMap[type]) {
      isType = true
      break
    }
  }

  if (!(isType)) {
    continue
  }

  if (element.creationDate && !(formattedData[element.creationDate])) {
    formattedData[element.creationDate] = {}
  }

  for (var type in typeMap) {
    if (element.type === typeMap[type]) {
      formattedData[element.creationDate][type] = element.value
    }
  }
}

// Filter the data, only want objects with all properties
var dataArray = []
for (var key in formattedData) {
  let objectKeys = Object.keys(formattedData[key])
  let requiredKeys = Object.keys(typeMap)

  if (!(_.differenceWith(requiredKeys, objectKeys, _.isEqual).length === 0)) {
    delete formattedData[key]
    continue
  }

  let obj = {
    "Date": new Date(key),
    "Time": Date.parse(key),
    "Weight": Number(formattedData[key]['weight']),
    "Body Fat": Number(formattedData[key]['bodyFat']) * 100,
    "Lean Body Mass": Number(formattedData[key]['leanBodyMass'])
  }
  dataArray.push(obj)
}

fs.writeFileSync('fitnessData.xlsx', json2xls(dataArray), 'binary')

rimraf.sync(path.join(EXPORT_PATH, '..'))
