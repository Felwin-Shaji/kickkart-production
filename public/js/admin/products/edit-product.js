// Initialize the variant counter based on existing variants

document.addEventListener("DOMContentLoaded", () => {
    const variantCountElement = document.getElementById('variant-count'); // Hidden input to track count
    let variantCount = variantCountElement ? parseInt(variantCountElement.value, 10) : 0;

    const variantSection = document.getElementById('variant-section'); // Parent container for variants

    // Function to renumber the variants
    function renumberVariants() {
        const variants = document.querySelectorAll('.variant-group'); // All variant groups
        variants.forEach((variant, index) => {
            const variantNumber = index + 1;
            variant.id = `variant-${variantNumber}`;
            variant.querySelector('h4').textContent = `Variant ${variantNumber}`;
            const removeButton = variant.querySelector('button');
            removeButton.setAttribute('onclick', `removeVariant('variant-${variantNumber}')`);
        });

        // Update variant count in the hidden input
        variantCount = variants.length;
        if (variantCountElement) {
            variantCountElement.value = variantCount;
        }
    }

    // Function to add a new variant
    window.addVariant = function () {
        variantCount++;
        const newVariant = document.createElement('div');
        newVariant.className = 'variant-group mb-3';
        newVariant.id = `variant-${variantCount}`;
        newVariant.innerHTML = `
      <h4>Variant ${variantCount}</h4>
      <div class="row">
        <div class="col-lg-4">
          <label class="form-label">Size</label>
          <input name="variantSize[]" type="text" class="border">
        </div>
        <div class="col-lg-4">
          <label class="form-label">Quantity</label>
          <input name="variantQuantity[]" type="number" class="border">
        </div>
        <div class="col-lg-4">
          <button type="button" class="btn btn-danger mt-3" onclick="removeVariant('variant-${variantCount}')">Remove</button>
        </div>
      </div>
    `;
        variantSection.appendChild(newVariant);
        renumberVariants(); // Renumber variants after adding
    };

    window.removeVariant = function (variantId) {
        const variantToRemove = document.getElementById(variantId);
        if (variantToRemove) {
            variantToRemove.remove();
            renumberVariants();
        }
    };
});

document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector("form");

    form.addEventListener("submit", function (event) {
        let isValid = true;

        // Clear previous errors
        document.querySelectorAll(".error-message").forEach(el => el.innerText = "");

        // Validate Product Name, Brand, Category, Description, Price (Existing Code)
        const productName = document.getElementById("product_name").value.trim();
        const brand = document.querySelector("select[name='brand']").value;
        const category = document.querySelector("select[name='category']").value;
        const description = document.getElementById("descriptionid").value.trim();
        const regularPrice = document.querySelector("input[name='regularPrice']").value.trim();

        if (productName === "") {
            displayError("productName-error", "Product Name is required");
            isValid = false;
        }

        if (brand === "" || brand === "Select Brand") {
            displayError("brand-error", "Please select a brand");
            isValid = false;
        }

        if (category === "" || category === "Select Category") {
            displayError("category-error", "Please select a category");
            isValid = false;
        }

        if (description === "") {
            displayError("description-error", "Description cannot be empty");
            isValid = false;
        }

        if (regularPrice === "" || isNaN(regularPrice) || parseFloat(regularPrice) <= 0) {
            displayError("regularPrice-error", "Enter a valid price");
            isValid = false;
        }

        // Variant Validation
        document.querySelectorAll(".variant-group").forEach((variant, index) => {
            const sizeInput = variant.querySelector("input[name='variantSize[]']").value.trim();
            const quantityInput = variant.querySelector("input[name='variantQuantity[]']").value.trim();

            if (sizeInput === "") {
                displayError(`variant-size-error-${index}`, "Size is required");
                isValid = false;
            }

            if (quantityInput === "" || isNaN(quantityInput) || parseInt(quantityInput) <= 0) {
                displayError(`variant-quantity-error-${index}`, "Enter a valid quantity");
                isValid = false;
            }
        });

        // Prevent form submission if validation fails
        if (!isValid) {
            event.preventDefault();
        } else {
            // If valid, show success message with Swal
            event.preventDefault(); // Prevent actual submission for demo
            Swal.fire({
                title: "Success!",
                text: "Product added successfully!",
                icon: "success"
            }).then(() => {
                form.submit(); // Submit after alert confirmation
            });
        }
    });

    // Function to display errors
    function displayError(id, message) {
        const errorElement = document.getElementById(id);
        if (errorElement) {
            errorElement.innerText = message;
        }
    }
});

function viewImage1(event) {
    document.getElementById('imgView1').src = URL.createObjectURL(event.target.files[0])
}
function viewImage2(event) {
    document.getElementById('imgView2').src = URL.createObjectURL(event.target.files[0])
}
function viewImage3(event) {
    document.getElementById('imgView3').src = URL.createObjectURL(event.target.files[0])
}
function viewImage4(event) {
    document.getElementById('imgView4').src = URL.createObjectURL(event.target.files[0])
}
function viewImage(event, index) {
    let input = event.target;
    let reader = new FileReader();

    reader.onload = function () {
        let dataURL = reader.result;
        let image = document.getElementById("imgView" + index);
        image.src = dataURL;

        let cropper = new Cropper(image, {
            aspectRatio: 1,
            viewMode: 1,
            guides: true,
            background: false,
            autoCropArea: 1,
            zoomable: true
        });

        let cropperContainer = document.querySelector("#croppedImg" + index).parentNode;
        cropperContainer.style.display = 'block';

        let saveButton = document.querySelector('#saveButton' + index);
        saveButton.addEventListener('click', function () {
            let croppedCanvas = cropper.getCroppedCanvas();
            let croppedImage = document.getElementById("croppedImg" + index);
            croppedImage.src = croppedCanvas.toDataURL("image/jpeg", 1.0);

            croppedCanvas.toBlob(blob => {
                let timestamp = new Date().getTime();
                let fileName = `cropped-img-${timestamp}-${index}.png`;

                let inputElement = document.getElementById('input' + index);
                let croppedFile = new File([blob], fileName, { type: "image/png" });
                const fileList = new DataTransfer();
                fileList.items.add(croppedFile);
                inputElement.files = fileList.files;

                cropperContainer.style.display = 'none';
                cropper.destroy();
            }, "image/png", 1.0);
        });
    };

    reader.readAsDataURL(input.files[0]);
}

const selectedImages = [];
document.getElementById("input1").addEventListener("change", handleFileSelect);

function handleFileSelect(event) {
    const addedImagesContainer = document.getElementById('addedImagesContainer');
    addedImagesContainer.innerHTML = '';
    const files = event.target.files;

    for (let i = 0; i < files.length; i++) {
        const currentFile = files[i];
        selectedImages.push(currentFile);

        const thumbnail = document.createElement("div");
        thumbnail.classList.add("thumbnail");

        const img = document.createElement("img");
        img.src = URL.createObjectURL(currentFile);
        img.alt = 'thumbnail';

        const removeIcon = document.createElement("span");
        removeIcon.classList.add("remove-icon");
        removeIcon.innerHTML = "&times;";
        removeIcon.addEventListener("click", function () {
            const index = selectedImages.indexOf(currentFile);
            if (index !== -1) {
                selectedImages.splice(index, 1);
            }
            thumbnail.remove();
        });

        const cropButton = document.createElement("button");
        cropButton.classList.add("crop-button");
        cropButton.textContent = "Crop";
        cropButton.addEventListener("click", function () {
            showCropModal(currentFile, thumbnail);
        });

        thumbnail.appendChild(img);
        thumbnail.appendChild(removeIcon);
        thumbnail.appendChild(cropButton);

        addedImagesContainer.appendChild(thumbnail);
    }
}

async function deleteSingleImage(imageId, productId) {
    console.log("response");
    try {

        const response = await fetch('/admin/daleteImages', { // Fixed typo
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageId, productId })
        });

        console.log("response", response);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        console.log("result", result);

        if (result.success) {

            window.location.reload();
        } else {
            console.error('Failed to delete image:', result.message);
            alert('Failed to delete image. Please try again.');
        }
    } catch (error) {

    }
}

