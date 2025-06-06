const express = require('express')
const app = express()
//const {io} = require('../app')

//Booking
const bookingRoute = require('./booking/booking.route')
const recommendationRoute = require('./booking/recommendation.route')
const invoiceRoute = require('./booking/invoice.route')
const paymentRoute = require('./booking/payment.route')
const roomRoute = require('./booking/room.route')
const voucherRoute = require('./booking/voucher.route')
const reviewRoute = require('./booking/review.route')
const serviceRoute = require('./booking/service.route')

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
const emailRoute = require('./general/email.route')

//Social 
const postRoute = require('./social/post.route')
const hashtagRoute = require('./social/hashtag.route')
const reactRoute = require('./social/react.route')
const reactCommentRoute = require('./social/react-comment.route')
const commentRoute = require('./social/comment.route')
const relationRoute = require('./social/relation.route')

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
router.use('/', bookingRoute)
router.use('/', recommendationRoute)
router.use('/', invoiceRoute)
router.use('/', paymentRoute)
router.use('/', roomRoute)
router.use('/', postRoute)
router.use('/', hashtagRoute)
router.use('/', reactRoute)
router.use('/', commentRoute)
router.use('/', reactCommentRoute)
router.use('/', relationRoute)
router.use('/', voucherRoute)
router.use('/', reviewRoute)
router.use('/', serviceRoute)
router.use('/', emailRoute)


module.exports = router

