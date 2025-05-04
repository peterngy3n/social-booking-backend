const express = require('express')
const app = express()
//const {io} = require('../app')


//General

const authRoute = require('./general/auth.route')
const locationRoute = require('./general/location.route')
const businessRoute = require('./general/business.route')
const userCollectionRoute = require('./general/user-collection.route')
const uploadImageRoute = require('./general/upload-image.route')
const conversationRoute = require('./general/conversation.route')
const messageRoute = require('./general//message.route')
const executeCronJobRoute = require('./general/execute-cronjob.route')
const socketRoute = require('./general/socket.route')

const router = express.Router();
//const io = app.get('io')

router.use('/', authRoute)
router.use('/', locationRoute)
router.use('/', businessRoute)
router.use('/', userCollectionRoute)
router.use('/', uploadImageRoute)
router.use('/', conversationRoute)
router.use('/', messageRoute)
router.use('/', executeCronJobRoute)
router.use('/', socketRoute)

module.exports = router

