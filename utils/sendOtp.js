const fs = require("fs");
const path = require("path");

const logFilePath = path.join(__dirname, "../logs/otp_logs.txt"); // Ensure the logs directory exists

const sendOtp = (mobile, otp) => {
    const logMessage = `OTP: ${otp} sent to Mobile: ${mobile} at ${new Date().toISOString()}\n`;

    // Log OTP in console
    console.log(logMessage);

    // Append OTP to log file
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error("Error logging OTP:", err);
        }
    });

    // Here, integrate actual SMS API like Twilio, Fast2SMS, or Firebase
};

module.exports = sendOtp;
