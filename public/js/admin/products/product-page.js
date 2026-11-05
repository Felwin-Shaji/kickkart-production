function confirmAction(productId, action) {
    Swal.fire({
        title: `Are you sure you want to ${action} this product?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: action === "block" ? "#d33" : "#28a745",
        cancelButtonColor: "#6c757d",
        confirmButtonText: `Yes, ${action}`,
        cancelButtonText: "Cancel"
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = `/admin/${action}Product?_id=${productId}`;
        }
    });
}

async function submitOffer(productId) {
    // Get the input field value
    const offerInput = document.getElementById(`offerInput${productId}`);
    const offerValue = offerInput.value;

    // Validate the input
    if (offerValue < 0 || offerValue > 100) {
        return Swal.fire({
            icon: 'error',
            title: 'Invalid Offer',
            text: 'Please enter a valid offer percentage between 0 and 100.',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
        });
    }

    try {
        // Send the offer to the backend
        const response = await fetch(`/admin/add-offer/${productId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ offer: offerValue }),
        });

        const result = await response.json();

        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: result.message,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true,
            });
            setTimeout(() => {
                location.reload();
            }, 1500);

        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: result.message || 'Something went wrong!',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            });
        }
    } catch (error) {
        console.error('Error adding/removing offer:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'An error occurred. Please try again later.',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
        });
    }
}

