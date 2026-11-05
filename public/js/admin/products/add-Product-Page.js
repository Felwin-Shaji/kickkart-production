
document.getElementById("productForm").addEventListener("submit", async function (event) {
    event.preventDefault(); // Prevent traditional form submission

    const form = event.target;
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true; // Disable the submit button to prevent multiple submissions

    const formData = new FormData(form); // Collect form data

    try {
        const response = await fetch(form.action, {
            method: "POST",
            body: formData
        });

        const result = await response.json(); // Assuming server responds with JSON

        if (response.ok) {
            Swal.fire({
                icon: "success",
                title: "Success!",
                text: result.message || "Product added successfully!",
                showConfirmButton: false,
                timer: 2000
            });

            setTimeout(() => {
                if (result.redirectUrl) {
                    window.location.href = result.redirectUrl;
                } else {
                    form.reset(); // Reset form if no redirect is given
                }
            }, 2000);
        } else {
            Swal.fire({
                icon: "error",
                title: "Error!",
                text: result.message || "Something went wrong!",
            });
        }
    } catch (error) {
        console.error("Error submitting form:", error);
        Swal.fire({
            icon: "error",
            title: "Oops...",
            text: "Something went wrong. Please try again.",
        });
    } finally {
        submitButton.disabled = false; // Re-enable the submit button after the submission process is complete
    }
});

let variantCount = 1;
function addVariant() {
    variantCount++;
    const variantSection = document.getElementById("variant-section");

    const newVariant = document.createElement("div");
    newVariant.classList.add("variant-group", "mb-3");
    newVariant.id = `variant-${variantCount}`;

    newVariant.innerHTML = `
        <h4>Variant ${variantCount}</h4>
        <div class="row">
            <div class="col-lg-4">
                <label class="form-label">Size</label>
                <input name="variantSize[]" type="text" class="border" placeholder="Enter size">
                 <div id="size-error-${variantCount}" class="error-message"></div>
            </div>

            <div class="col-lg-4">
                <label class="form-label">Quantity</label>
                <input name="variantQuantity[]" type="number" class="border" placeholder="Enter quantity">
                <div id="quantity-error-${variantCount}" class="error-message"></div>
            </div>
             
        </div>
       
        <button type="button" class="btn btn-danger mt-2" onclick="removeVariant('variant-${variantCount}')">Remove Variant</button>
    `;

    variantSection.appendChild(newVariant);

}

function removeVariant(variantId) {
    const variantElement = document.getElementById(variantId);
    if (variantElement) {
        variantElement.remove();
    }
}



function validateAndSubmit(event) {
    if (validateForm() == true) {
        const form = document.getElementById("productForm");
        const formData = new FormData(form);

        for (const pair of formData.entries()) {
            console.log(pair[0] + ': ' + pair[1]);
        }
        form.submit(); // Only submit if validation passes
    }
}



function validateForm() {
    clearErrorMessages();

    const name = document.getElementsByName("productName")[0].value.trim();
    const description = document.getElementById("descriptionid").value.trim();
    const brand = document.getElementsByName("brand")[0].value.trim();
    const price = document.getElementsByName("regularPrice")[0].value.trim();
    const category = document.getElementsByName("category")[0].value.trim();
    const images = document.querySelectorAll("input[type='file']");

    const variantSizes = document.getElementsByName("variantSize[]");

    const variantQuantities = document.getElementsByName("variantQuantity[]");

    let isValid = true;

    if (name === "") {
        const message = "Please enter a product name."
        displayErrorMessage("productName-error", "Please enter a product name.");

        isValid = false;
    }

    if (description === "") {
        displayErrorMessage("description-error", "Please enter a product description.");
        isValid = false;
    }

    if (brand === "") {
        displayErrorMessage("brand-error", "Please select a brand.");
        isValid = false;
    }

    if (category === "") {
        displayErrorMessage("category-error", "Please select a category.");
        isValid = false;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(price) || parseFloat(price) <= 0) {
        displayErrorMessage("regularPrice-error", "Please enter a valid positive regular price.");
        isValid = false;
    }

    for (let i = 0; i < variantSizes.length; i++) {
        const size = variantSizes[i].value.trim();

        const quantity = variantQuantities[i].value.trim();

        if (size === "") {
            displayErrorMessage(`size-error-${i + 1}`, `Please enter a size for variant ${i + 1}.`);
            isValid = false;
        }



        if (!/^\d+$/.test(quantity) || parseInt(quantity) < 0) {
            displayErrorMessage(`quantity-error-${i + 1}`, `Please enter a valid non-negative quantity for variant ${i + 1}.`);
            isValid = false;
        }
    }

    let imageCount = 0;
    images.forEach((imageInput, index) => {
        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];

            if (!allowedTypes.includes(file.type)) {
                displayErrorMessage(`images-error`, `Invalid file type for Image ${index + 1}. Please select a PNG, JPEG, or JPG file.`);
                isValid = false;
            } else {
                imageCount++;
            }
        }
    });

    if (imageCount < 3) {
        displayErrorMessage("images-error", "Please select at least 3 valid image files.");
        isValid = false;
    }

    return isValid;
}


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


function displayErrorMessage(elementId, message) {
    var errorElement = document.getElementById(elementId);
    errorElement.innerText = message;
    errorElement.style.display = "block";
}


function clearErrorMessages() {
    const errorElements = document.getElementsByClassName('error-message');
    Array.from(errorElements).forEach(element => {
        element.innerText = '';
    });
    const errorMessage = document.getElementById('errorMessage');


}
