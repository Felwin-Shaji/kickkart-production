
document.addEventListener("DOMContentLoaded", () => {
    const toggleButton = document.getElementById("showCouponsToggle");
    const couponsContainer = document.getElementById("couponsContainer");

    toggleButton.addEventListener("click", (event) => {
        event.preventDefault(); // Prevent the default link behavior

        // Toggle the visibility of the coupons container
        if (couponsContainer.style.display === "none") {
            couponsContainer.style.display = "block";
            toggleButton.textContent = "Hide Coupons";
        } else {
            couponsContainer.style.display = "none";
            toggleButton.textContent = "Available Coupons - See Here";
        }
    });
});

// Initialize Clipboard.js
var clipboard = new ClipboardJS('.btn');

clipboard.on('success', function (e) {
    e.clearSelection();

    // Change the button text and style after copying
    var button = e.trigger;
    button.textContent = 'Copied!';
    button.classList.remove('btn-outline-success');
    button.classList.add('btn-success');
    button.disabled = true; // Disable the button to prevent multiple copies

    // Revert the button back to the original state after 2 seconds
    setTimeout(function () {
        button.textContent = 'Copy Code';
        button.classList.remove('btn-success');
        button.classList.add('btn-outline-success');
        button.disabled = false;
    }, 2000); // Change back after 2 seconds
});

clipboard.on('error', function (e) {
    alert('Failed to copy code.');
});

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("orderForm").addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData(this);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        if (!data.paymentMethod) {
            Swal.fire({
                icon: "warning",
                title: "Payment Method Required",
                text: "Please select an available payment method before proceeding.",
                showConfirmButton: true,
                allowOutsideClick: false, // Prevent closing without user action
            });
            return;
        }



        if (data.paymentMethod == "COD") {
            try {
                const response = await fetch("/place-order", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(data),
                });

                const responseText = await response.text();

                if (response.ok) {
                    Swal.fire({
                        icon: "success",
                        title: "Order Placed!",
                        text: "Your order has been placed successfully!",
                        timer: 3000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                    });

                    setTimeout(() => {
                        window.location.href = "/order-success";
                    }, 3000);
                } else {
                    const error = JSON.parse(responseText);
                    Swal.fire({
                        icon: "error",
                        title: "Oops!",
                        text: `Error: ${error.message}`,
                        showConfirmButton: true,
                    });
                }
            } catch (error) {
                console.error("Error placing order:", error);
                Swal.fire({
                    icon: "error",
                    title: "Oops!",
                    text: "An error occurred while placing your order. Please try again.",
                    showConfirmButton: true,
                });
            }

        } else if (data.paymentMethod === "Online") {
            console.log("Total Amount for Payment:", data.totalAmount);

            try {
                const response = await fetch("/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        amount: data.totalAmount,
                        currency: "INR",
                        selectedAddress: data.selectedAddress,
                        paymentMethod: "Online",
                        coupenCode: data.coupenCode || null,
                        coupenOffer: data.coupenOffer || 0,
                        totalregularPrice: data.totalregularPrice,
                    }),
                });

                console.log("Sending request to /create-order with data:", {
                    amount: data.totalAmount,
                    currency: "INR",
                    selectedAddress: data.selectedAddress,
                    paymentMethod: "Online",
                    coupenCode: data.coupenCode || null,
                    coupenOffer: data.coupenOffer || 0,
                    totalregularPrice: data.totalregularPrice,
                });


                const orderData = await response.json();

                if (!orderData.success) {
                    Swal.fire({
                        icon: "info",
                        title: "Oops!",
                        text: "Error: Please select an address or create a new one.",
                        showConfirmButton: true,

                    });
                    return;
                }


                const options = {
                    key: "rzp_test_FgtVyF2A1Al0K2",
                    amount: orderData.order.amount,
                    currency: orderData.order.currency,
                    name: "KICKKART",
                    description: "Order Payment",
                    order_id: orderData.order.id,
                    handler: async function (response) {
                        console.log("Razorpay Payment Success Response:", response);

                        try {
                            const verifyResponse = await fetch("/verify-payment", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature,
                                    status: "completed",
                                    data
                                }),
                            });

                            const verifyData = await verifyResponse.json();

                            if (verifyData.success) {
                                Swal.fire({
                                    icon: "success",
                                    title: "Payment Successful!",
                                    text: "Your payment was successful, and your order has been placed.",
                                    timer: 3000,
                                    timerProgressBar: true,
                                    showConfirmButton: false,
                                });

                                setTimeout(() => {
                                    window.location.href = "/order-success";
                                }, 3000);
                            } else {
                                Swal.fire({
                                    icon: "error",
                                    title: "Payment Verification Failed",
                                    text: "Your payment could not be verified. Please contact support.",
                                    showConfirmButton: true,
                                });
                            }
                        } catch (error) {
                            console.error("Error verifying payment:", error);
                            Swal.fire({
                                icon: "error",
                                title: "Oops!",
                                text: "An error occurred during payment verification. Please try again.",
                                showConfirmButton: true,
                            });
                        }
                    },
                    prefill: {
                        name: data.name,
                        email: data.email,
                        contact: data.phone,
                    },
                    theme: { color: "#3399cc" },
                    modal: {
                        ondismiss: async function () {
                            console.log("Payment modal closed. Payment failed or user cancelled.");
                            Swal.fire({
                                icon: "error",
                                title: "Payment Cancelled",
                                text: "You closed the payment window. Please try again.",
                                showConfirmButton: true,
                            });

                            try {
                                console.log("222222222222222222222222222222222222222222");

                                await fetch("/verify-payment", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        razorpay_order_id: orderData.order.id,
                                        razorpay_payment_id: null,
                                        razorpay_signature: null,
                                        status: "failed",
                                        data
                                    }),
                                });

                                window.location.href = "/order-failed";
                            } catch (error) {
                                console.error("Error logging failed payment:", error);
                            }
                        }
                    }
                };


                const rzp1 = new Razorpay(options);
                rzp1.open();




            } catch (error) {
                console.error("Error initiating online payment:", error);
                Swal.fire({
                    icon: "error",
                    title: "Oops!",
                    text: "An error occurred while initiating the payment. Please try again.",
                    showConfirmButton: true,
                });
            }
        } else if (data.paymentMethod === "Wallet") {
            try {
                const response = await fetch("/place-order-wallet", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(data),
                });

                const responseText = await response.text();

                if (response.ok) {
                    Swal.fire({
                        icon: "success",
                        title: "Order Placed!",
                        text: "Your order has been placed successfully!",
                        timer: 3000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                    });

                    setTimeout(() => {
                        window.location.href = "/order-success";
                    }, 3000);
                } else {
                    const error = JSON.parse(responseText);
                    Swal.fire({
                        icon: "error",
                        title: "Oops!",
                        text: `Error: ${error.message}`,
                        showConfirmButton: true,
                    });
                }
            } catch (error) {
                console.error("Error placing order:", error);
                Swal.fire({
                    icon: "error",
                    title: "Oops!",
                    text: "An error occurred while placing your order. Please try again.",
                    showConfirmButton: true,
                });
            }

        }


    });
});

document.addEventListener("DOMContentLoaded", () => {
    const couponForm = document.getElementById("couponForm");
    const couponInput = document.getElementById("couponNumber");
    const totalAmountBfrCoupn = document.getElementById("totalAmountBfrCoupn");
    const errorMessage = document.getElementById("errorMessage");
    const responseMessage = document.getElementById("responseMessage");
    const orderTotalElement = document.getElementById("orderTotal");
    const coupenOfferElement = document.getElementById("couponOffer");
    const coupenOfferPriceElement = document.getElementById("coupenOfferPrice");
    const totalAmountElement = document.getElementById("totalAmount");
    const coupenCodeElement = document.getElementById("coupenCode")
    const applyCouponButton = document.getElementById("applyCouponButton");
    const removeCouponButton = document.getElementById("removeCouponButton");

    function updateHiddenFields(discountAmount, totalPrice, couponCode) {
        // Update the hidden inputs
        coupenOfferPriceElement.value = discountAmount;
        totalAmountElement.value = totalPrice;
        coupenCodeElement.value = couponCode;

        // Debug logs to verify updates
        console.log("Updated Hidden Fields:");
        console.log("Coupon Offer Price:", coupenOfferPriceElement.value);
        console.log("Total Amount:", totalAmountElement.value);
        console.log("Coupon Code:", coupenCodeElement.value);
    }


    async function applyCoupon(event) {
        event.preventDefault();

        const couponNumber = couponInput.value.trim();
        const PriceBrfCoupen = totalAmountBfrCoupn.value.trim();

        if (!couponNumber) {
            errorMessage.style.display = "block";
            errorMessage.textContent = "Please enter a coupon number.";
            return;
        }
        errorMessage.style.display = "none";

        try {
            const response = await fetch("/applyCoupen", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ couponNumber, PriceBrfCoupen }),
            });

            const data = await response.json();

            responseMessage.style.display = "block";
            if (response.ok) {
                responseMessage.style.color = "green";
                responseMessage.textContent = data.message;

                if (data.discount) {
                    let priceBeforeCoupon = Number(orderTotalElement.textContent.replace(/₹/, "").trim());
                    let discountAmount = (priceBeforeCoupon * data.discount) / 100;

                    let totalPrice = priceBeforeCoupon - discountAmount;

                    // Update the hidden fields
                    updateHiddenFields(discountAmount, totalPrice, data.couponNumber);

                    coupenOfferElement.textContent = `${data.discount}%`;
                    orderTotalElement.textContent = `₹${totalPrice.toFixed(2)}`;

                    // Toggle buttons
                    applyCouponButton.style.display = "none";
                    removeCouponButton.style.display = "block";
                }
            } else {
                responseMessage.style.color = "red";
                responseMessage.textContent = data.message;
            }
        } catch (error) {
            console.error("Error applying coupon:", error);
            responseMessage.style.display = "block";
            responseMessage.style.color = "red";
            responseMessage.textContent = "Something went wrong. Please try again.";
        }
    }


    function removeCoupon() {
        // Reset the coupon-related values
        coupenOfferElement.textContent = "₹00.00";
        orderTotalElement.textContent = `₹${totalAmountBfrCoupn.value}`;
        coupenOfferPriceElement.value = 0;
        totalAmountElement.value = totalAmountBfrCoupn.value;

        // Clear the input field and hide/remove messages
        couponInput.value = "";
        errorMessage.style.display = "none";

        // Show success message for 3 seconds
        responseMessage.style.display = "block";
        responseMessage.style.color = "green";
        responseMessage.textContent = "Coupon removed successfully!";
        setTimeout(() => {
            responseMessage.style.display = "none";
        }, 3000);


        // Toggle buttons
        applyCouponButton.style.display = "block";
        removeCouponButton.style.display = "none";
    }

    couponForm.addEventListener("submit", applyCoupon);
    removeCouponButton.addEventListener("click", removeCoupon);
});
