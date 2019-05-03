require("dotenv/config")
const accountSid = process.env.accountSID
const authToken = process.env.authTOKEN

const http = require("http")
const express = require("express")
const MessagingResponse = require("twilio").twiml.MessagingResponse
const bodyParser = require("body-parser")
const cors = require("cors")
const pizzapi = require("dominos")

const app = express()

var firebase = require("firebase")
require("firebase/auth")
require("firebase/database")

var firebaseApp = firebase.initializeApp({
    apiKey: "AIzaSyAzngzitaO5nmWemiZoREbtEPyz5399ikw",
    authDomain: "twilioapi-9d541.firebaseapp.com",
    databaseURL: "https://twilioapi-9d541.firebaseio.com",
    projectId: "twilioapi-9d541",
    storageBucket: "twilioapi-9d541.appspot.com",
    messagingSenderId: "586136443689"
})

var database = firebase.database()

app.use(cors( {origin: true, credentials: true}))

app.use(bodyParser.urlencoded({ extended: false }))

function isYes(msg) {
    return msg === "yes" || msg === "Yes" || msg === "yes " || msg === "Yes "
}

var myStore = new pizzapi.Store({ID: 4336})
var store = {menu: "food"}

myStore.getMenu(
    function(storeData){
        var menu = storeData.menuData
        firebase.database().ref("/storeData").set({
            menu
        })
    }
)

app.get("/", (req, res) => {
    myStore.getMenu(
        function(storeData){
            var menu = storeData.menuData
            firebase.database().ref("/storeData").set({
                menu
            })
        }
    )

    const client = require("twilio")(accountSid, authToken)

    var readRef = firebase.database().ref("/firebaseObj")
    readRef.on("value", function(snapshot) {
        var phoneNumber = snapshot.val().phone
        var menuItemName = snapshot.val().menuitemname
        client.messages.create({
            to: phoneNumber,
            from: "13145825438",
            body: "Would you like to order a " + menuItemName + "? [ yes | no ]"
        }).then(function(message) {
            res.json(message)
        }).catch(function(err){
            res.send(err)
        })
    })
})

app.post("/", (req, res) => {
    console.log(req.body)
    var firebaseObj = req.body
    function writeUserData() {
        firebase.database().ref("/").set({
            firebaseObj
        })
    }

    writeUserData()
    res.send(req.body)
})

app.post("/sms", (req, res) => {
    const twiml = new MessagingResponse()
    if(!isYes(req.body.Body)){
        twiml.message("Your loss.")
        res.writeHead(200, {"Content-Type": "text/xml"})
        res.end(twiml.toString())
    } else {
        pizzapi.Util.findNearbyStores(
            "1644 Platte St., Denver, CO, 80203",
            "Delivery",
            function(storeData){
                var readRef = firebase.database().ref("/firebaseObj")
                readRef.on("value", function(snapshot) {
                    var firstName = snapshot.val().firstname
                    var lastName = snapshot.val().lastname
                    var streetAddress = snapshot.val().streetaddress
                    var city = snapshot.val().city
                    var state = snapshot.val().state
                    var zipCode = snapshot.val().zipcode
                    var phone = snapshot.val().phone
                    var email = snapshot.val().email
                    var cardNumber = snapshot.val().cardnumber
                    var expMonth = snapshot.val().expmonth
                    var expYear = snapshot.val().expyear
                    var securityCode = snapshot.val().securitycode
                    var billingZip = snapshot.val().billingzip
                    var menuItem = snapshot.val().menuitem
                    var expDate = expMonth + expYear

                    var storeId = storeData.result.Stores[0].StoreID
                    var storeNumber = Number(storeId)

                    var myStore = new pizzapi.Store(storeData.result.Stores[0])
                    myStore.ID = storeNumber

                    var address = new pizzapi.Address({
                        Street: streetAddress,
                        City: city,
                        Region: state,
                        PostalCode: zipCode
                    })

                    var customerProfile = new pizzapi.Customer(
                        {
                            firstName: firstName,
                            lastName: lastName,
                            address: address,
                            email: email,
                            phone: phone
                        }
                    )

                    var order = new pizzapi.Order(
                        {
                            customer: customerProfile,
                            storeID: myStore.ID,
                            deliveryMethod: "Delivery"
                        }
                    )

                    order.addItem(
                        new pizzapi.Item(
                            {
                                code: menuItem,
                                options: {},
                                quantity: 1
                            }
                        )
                    )

                    var cardNumber = cardNumber
                    var cardInfo = new order.PaymentObject()
                    cardInfo.Amount = order.Amounts.Customer
                    cardInfo.Number = cardNumber
                    cardInfo.CardType = order.validateCC(cardNumber)
                    cardInfo.Expiration = expDate
                    cardInfo.SecurityCode = securityCode
                    cardInfo.PostalCode = billingZip
                    order.Payments.push(cardInfo)

                    order.validate(
                        function(result) {
                            console.log(result)
                            console.log("Order validated.")

                            order.price(
                                function(result) {
                                    console.log(result)
                                    console.log("Order priced.")

                                    order.place(
                                        function(result) {
                                            console.log("Order Placed Result: " + JSON.stringify(result))
                                            console.log("Order placed.")

                                            pizzapi.Track.byPhone(
                                                3149565183,
                                                function(pizzaData){
                                                    console.log("Pizza Data: " + JSON.stringify(pizzaData))
                                                }
                                            )
                                        }
                                    )
                                }
                            )
                        }
                    )

                    console.log("Order: " + JSON.stringify(order))

                    twiml.message("Order sent. Don\'t forget to tip the driver.")
                    res.writeHead(200, {"Content-Type": "text/xml"})
                    res.end(twiml.toString())
                })
            }
        )
    }
})

const port = process.env.PORT || 1337

http.createServer(app).listen(port, () => {
    console.log("port: " + port)
})

console.log("Exit Code 0")
