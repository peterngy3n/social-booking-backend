const Booking = require('../../models/booking/booking.model').Booking
const ServiceBooked = require('../../models/booking/booking.model').ServiceBooked
const Location = require('../../models/general/location.model')
const Service = require('../../models/booking/service.model')
const roomService = require('../../services/booking/room.service')
const voucherService = require('../../services/booking/voucher.service')
const previewBookingService = require('../../services/booking/preview-booking.service')
const voucherUserService = require('../../services/booking/voucher-user.service')
const Room = require('../../models/booking/room.model')
const {NotFoundException, ForbiddenError} = require('../../errors/exception')
const { default: mongoose } = require('mongoose')
const BookingBuilder = require('../../components/builder/booking.builder')

const updateStatusBooking = async (bookingId, amountPayed) => {
    const booking = await Booking.findById(bookingId);
    if(!booking)
        throw new NotFoundException('Cannot found booking to calculate')
    booking.amountPaid = amountPayed
    await booking.save()
}

const getAllBooking = async () => {
    const result = await Booking.find()
    if(result.length !== 0)
        return result
    else
        throw new NotFoundException('Not found')
    
}
const getBookingById = async (id) => {
    console.log('id: ', id);    
    const result = await Booking.findById(id)
    .populate({
        path: 'items.roomId',
        select: 'name'
    })
    .populate({
        path: 'services.serviceId',
        select: 'name'
    }) 
    if(result)
        return result
    else
        throw new NotFoundException('Not found specific booking')
}

const getBookingByUserId = async (userId) => {
    const result = await Booking.find({userId : userId})
    if(result.length !== 0)
        return result
    else
        throw new NotFoundException('Not found')
}

//TODO: 
const getBookingByLocationId = async (locationId) => {
    const result = await Booking.aggregate([
        { $unwind: "$items" },

        {$lookup: {
            from: "Room",
            localField: "items.roomId",
            foreignField: "_id",
            as: "BookedRoom"
        }},

        { $unwind: "$BookedRoom"},
            // Lọc các tài liệu chỉ chứa roomId tương ứng
        { $match: { "BookedRoom.locationId": new mongoose.Types.ObjectId(locationId) } },
        {
            $group: {
                _id: "$_id", // Group theo booking ID
                userId: { $first: "$userId" },
                dateBooking: { $first: "$dateBooking" },
                checkinDate: { $first: "$checkinDate" },
                checkoutDate: { $first: "$checkoutDate" },
                totalPrice: { $first: "$totalPrice" },
                status: { $first: "$status" },
                items: {
                    $push: {
                        roomId: "$items.roomId",
                        quantity: "$items.quantity",
                        roomDetails: {
                            name: "$BookedRoom.name",
                            pricePerNight: "$BookedRoom.pricePerNight",
                        },
                    },
                },
            },
        },
    ]);
    if(result.length !== 0)
        return result
    else
        throw new NotFoundException('Not found')
}

const createBooking = async (bookingData) => {
    const { userId, dateBooking, checkinDate, checkoutDate, voucherId } = bookingData;
    const previewBooking = await previewBookingService.getBookingPreview(userId, preview_bookingId)
    const voucher = await voucherService.getVoucherById(voucherId)

    const booking = new BookingBuilder()
    .setUserId(userId)    
    .setDateBooking(dateBooking)
    .setRooms(previewBooking.items, checkinDate, checkoutDate)
    .setServices(previewBooking.services)
    .setVoucherId(voucherId)
    .setPrice(previewBooking.totalPrice)

    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();
        // 1. Kiểm tra & trừ số lượng phòng
        if(await roomService.getRoomAvailable(previewBooking.items, checkinDate, checkoutDate, session) === false) {
            throw new Error('Phòng đã được đặt')
        }
        // 2. Validate lại voucher
        if(voucherId) {
            const {totalPrice, discountAmount, totalPriceAfterDiscount} 
            = await voucherService.verifyVoucher(voucher.code, preview_bookingId, userId, session)
            booking.setVoucherId(new mongoose.Types.ObjectId(voucherId))
            booking.setDiscount(discountAmount)
        }
        console.log('Here: ')
        
        booking.setTax(0.08)

        // 3. Tạo booking

        booking.build()
        
        const bookingData = new Booking(booking.booking)
        const savedBooking = await bookingData.save({ session });

        

        // 4. Update các bên liên quan
        await voucherService.updateVoucher(
            voucherId,
            { $inc: { usesCount: 1 } }, // tăng 1 lượt dùng
            session);
        await voucherUserService.addVoucherUsage(userId, voucher.code, session);

        await session.commitTransaction();
        return savedBooking;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

}

const updateBooking = async (bookingId, bookingData) => {
    console.log('booking: ', await Booking.findById(bookingId));
    const result = await Booking.findByIdAndUpdate(bookingId, bookingData, {new: true, runValidators: true})
    if(result)
        return result
    else
        throw new NotFoundException('Not allow to update')
}

const addServices = async (bookingId, serviceId) => {
    const booking = await Booking.findById(bookingId)
    if(!booking)
        throw new NotFoundException('Not found booking to add service')
    const service = await Service.findById(serviceId)
    if(!service)
        throw new NotFoundException('Not found service')
    const newService = new ServiceBooked({
        serviceId: service.id,
        price: service.price
    })
    booking.services.push(newService)
    const result = await booking.save()
    if(result)
        return result
    else
        throw new ForbiddenError('Cannot add service')
}

const deleteBooking = async (bookingId) => {
    const result = Booking.findByIdAndDelete(bookingId)
    if(result)
        return result
    else
        throw new NotFoundException('Not allow to delete')
}

const getBookingByBusinessId = async (businessId) => {
    const locations = await Location.find({ ownerId: businessId });
    console.log('locations: ',locations)
    const locationIds = locations.map(location => location._id);
    const rooms = await Room.find({ locationId: { $in: locationIds } });
    console.log('rooms: ', rooms);
    const roomIds = rooms.map(room => room._id);
    console.log('roomId: ',roomIds);
    const bookings = await Booking.find({
        items: {
            $elemMatch: {
                roomId: { $in: roomIds }, 
            },
        },
    });
    return bookings;
};

const calculateTotalEstimatedPrice = async (rooms, services) => {
    //Lấy thông tin của các phòng từ database
    let totalServicePrice = 0
    let totalRoomPrice = 0
    if (rooms) {
        const roomIds = rooms.map(r => new mongoose.Types.ObjectId(r.roomId))
        const roomData = await Room.find({ _id: { $in: roomIds } }, { _id: 1, pricePerNight: 1})
        
        //Đưa data vào map để tối ưu thời gian
        const roomMap = new Map()
        roomData.forEach(r => roomMap.set(r._id.toString(), r.pricePerNight))

        //Tính tổng giá các phòng
        
        for (const r of rooms) {
            const roomPrice = roomMap.get(r.roomId)
            if(!roomPrice)
                throw new NotFoundException('Cannot found room')
            totalRoomPrice += roomPrice * r.quantity * r.nights
        }
    }

    //Lấy thông tin của các dịch vụ từ database
    if (services) {
        const serviceIds = services.map(s => new mongoose.Types.ObjectId(s.serviceId))
        const serviceData = await Service.find({ _id: { $in: serviceIds } }, { _id: 1, price: 1})
        
        //Đưa data vào map để tối ưu thời gian
        const serviceMap = new Map()
        serviceData.forEach(s => roomMap.set(s._id.toString(), s.price))

        //Tính tổng giá các phòng
        
        for (const s of services) {
            const servicePrice = serviceMap.get(r.roomId)
            if(!servicePrice)
                throw new NotFoundException('Cannot found service')
            totalServicePrice += servicePrice * s.quantity
        }
    }

    return totalRoomPrice + totalServicePrice
}

const getRevenueByMonth = async (month, year) => {
    const startDate = new Date(year, month - 1, 1); // Ngày đầu tiên của tháng
    const endDate = new Date(year, month, 1); // Ngày đầu tiên của tháng tiếp theo

    const result = await Booking.aggregate([
        {
            $match: {
                dateBooking: {
                    $gte: startDate,
                    $lt: endDate,
                },
            },
        },
        {
            $group: {
                _id: null, 
                totalRevenue: { $sum: "$totalPriceAfterTax" }, 
                totalBookings: { $sum: 1 }, 
            },
        },
    ]);

    if (result.length > 0) {
        return {
            totalRevenue: result[0].totalRevenue,
            totalBookings: result[0].totalBookings,
        };
    } else {
        return {
            totalRevenue: 0,
            totalBookings: 0,
        };
    }
};

const getBookingRevenueByMonthForBusiness = async (businessId, month, year) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);
    console.log('business ID: ', businessId);
  
    try {
      // Bước 1: Tìm tất cả các Room thuộc businessId qua Location
      const locations = await Location.find({ ownerId: businessId });
      console.log('Locations:', locations); // Kiểm tra nếu không có location
  
      const locationIds = locations.map(location => location._id);
      console.log('Location IDs:', locationIds);
  
      const rooms = await Room.find({ locationId: { $in: locationIds } });
      console.log('Rooms:', rooms); // Kiểm tra xem có phòng không
  
      const roomIds = rooms.map(room => room._id);
      console.log('Room IDs:', roomIds);
  
      // Bước 2: Tìm tất cả các Booking cho các Room của businessId trong tháng
      const bookings = await Booking.aggregate([
        { 
          $match: {
            dateBooking: {
              $gte: startDate,
              $lt: endDate,
            },
            "items.roomId": { $in: roomIds },
          }
        },
        {
            $unwind: "$items", 
        },
        {
            $match: {
                "items.roomId": { $in: roomIds }, 
            },
        },

        {
          $group: {
            _id: null,  
            totalRevenue: { $sum: "$totalPriceAfterTax" },
            totalBookings: { $sum: 1 },
          }
        }
      ]);
  
      console.log('Bookings Result:', bookings); 
  
      if (bookings.length > 0) {
        return {
          totalRevenue: bookings[0].totalRevenue,
          totalBookings: bookings[0].totalBookings,
        };
      } else {
        return {
          totalRevenue: 0,
          totalBookings: 0,
        };
      }
    } catch (error) {
      console.log('Error:', error);
      throw new Error("Error retrieving revenue data: " + error.message);
    }
};
  
module.exports = {
    updateStatusBooking,
    getAllBooking,
    getBookingById,
    getBookingByUserId,
    getBookingByLocationId,
    getBookingByBusinessId,
    createBooking,
    updateBooking,
    addServices,
    deleteBooking,
    getRevenueByMonth,
    getBookingRevenueByMonthForBusiness,
    calculateTotalEstimatedPrice
}