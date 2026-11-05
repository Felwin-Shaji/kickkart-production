document.addEventListener("DOMContentLoaded", () => {
    const quantityInputs = document.querySelectorAll(".quantity-input");
    const incrementButtons = document.querySelectorAll(".increment-btn");
    const decrementButtons = document.querySelectorAll(".decrement-btn");
    const removeButtons = document.querySelectorAll(".remove-item");
    const totalPrice = document.getElementsByClassName("variant-price")


    const totalPriceElement = document.querySelector("#totalPrice");
    const deliveryCharge = 0;
    const grandTotal = parseFloat(totalPriceElement.dataset.total);

    document.getElementById("delivery-charge").textContent = `₹ ${deliveryCharge.toFixed(2)}`;
    document.getElementById("grand-total").textContent = `₹ ${(grandTotal + deliveryCharge).toFixed(2)}`;


    async function updateQuantity(productId, size, newQuantity) {
        try {
            const response = await fetch(`/cartQuantity`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ productId, selectedSize: size, quantity: newQuantity }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || "Failed to update quantity.");
            }

            totalPrice.textContent = `₹ ${result.cart.items[0].price.toFixed(2)}`

            totalPriceElement.textContent = `₹ ${result.cart.totalPrice.toFixed(2)}`;
            const grandTotalElement = document.getElementById("grand-total");
            grandTotalElement.textContent = `₹ ${(result.cart.totalPrice + deliveryCharge).toFixed(2)}`;

            return result;
        } catch (error) {
            console.error("Error updating quantity:", error);
            Swal.fire("Error", error.message || "An unexpected error occurred.", "error");
            return null;
        }
    }


    function updateTotals() {
        let subtotal = 0;
        quantityInputs.forEach(input => {
            const price = parseFloat(input.dataset.price);
            const quantity = parseInt(input.value, 10);
            const itemSubtotal = price * quantity;
            subtotal += itemSubtotal;

            const subtotalElement = document.getElementById(input.dataset.subtotalId);
            subtotalElement.textContent = `₹ ${itemSubtotal.toFixed(2)}`;

            const variantPriceElement = input.closest(".product-cart").querySelector(".variant-price");
            variantPriceElement.textContent = `₹ ${itemSubtotal.toFixed(2)}`;
        });


        totalPriceElement.textContent = `₹ ${subtotal.toFixed(2)}`;
        const grandTotalElement = document.getElementById("grand-total");
        grandTotalElement.textContent = `₹ ${(subtotal + deliveryCharge).toFixed(2)}`;
    }

    // Increment Button 
    incrementButtons.forEach(button => {
        button.addEventListener("click", async () => {
            const input = button.parentElement.querySelector(".quantity-input");
            const productId = button.dataset.id;
            const size = button.dataset.size;
            const max = parseInt(input.getAttribute("max"), 10);
            const value = parseInt(input.value, 10);

            if (value < max) {
                const newQuantity = value + 1;
                const result = await updateQuantity(productId, size, newQuantity);
                if (result) {
                    input.value = newQuantity;

                    const itemSubtotal = newQuantity * parseFloat(input.dataset.price);
                    const variantPriceElement = input.closest(".product-cart").querySelector(".variant-price");
                    variantPriceElement.textContent = `₹ ${itemSubtotal.toFixed(2)}`;

                    updateTotals();
                }
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Insufficient Stock',
                    text: 'Sorry, we do not have enough stock for this item.',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#3085d6',
                });
            }
        });
    });

    // Decrement Button 
    decrementButtons.forEach(button => {
        button.addEventListener("click", async () => {
            const input = button.parentElement.querySelector(".quantity-input");
            const productId = button.dataset.id;
            const size = button.dataset.size;
            const min = parseInt(input.getAttribute("min"), 10);
            const value = parseInt(input.value, 10);


            if (value > min) {
                const newQuantity = value - 1;
                const result = await updateQuantity(productId, size, newQuantity);
                if (result) {
                    input.value = newQuantity;

                    const itemSubtotal = newQuantity * parseFloat(input.dataset.price);
                    const variantPriceElement = input.closest(".product-cart").querySelector(".variant-price");
                    variantPriceElement.textContent = `₹ ${itemSubtotal.toFixed(2)}`;

                    updateTotals();
                }
            }
        });
    });

    // Remove Button 
    removeButtons.forEach(button => {
        button.addEventListener("click", async () => {
            const productId = button.dataset.id;
            const size = button.dataset.size;
            try {
                const response = await fetch(`/removeFromCart/${productId}/${size}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                });
                const result = await response.json();
                if (response.ok) {
                    Swal.fire("Removed!", "Item removed from cart.", "success").then(() => location.reload());
                } else {
                    Swal.fire("Error", result.message || "Failed to remove item.", "error");
                }
            } catch (error) {
                Swal.fire("Error", "An unexpected error occurred.", "error");
            }
        });
    });

    updateTotals();
});