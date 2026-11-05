
document.querySelectorAll(".dropdown-item[data-filter]").forEach((item) => {

    item.addEventListener("click", (e) => {
        e.preventDefault();

        const filter = e.currentTarget.dataset.filter;

        const today = new Date();
        let startDate;
        let endDate = new Date(today);

        // Reset time
        today.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        switch (filter) {

            case "today":
                startDate = new Date(today);
                break;

            case "yesterday":
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 1);

                endDate = new Date(today);
                endDate.setMilliseconds(-1);
                break;

            case "7days":
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 6);
                break;

            case "30days":
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 29);
                break;

            case "thisMonth":
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;

            case "lastMonth":
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
                break;

            case "3months":
                startDate = new Date(today);
                startDate.setMonth(today.getMonth() - 3);
                break;

            case "6months":
                startDate = new Date(today);
                startDate.setMonth(today.getMonth() - 6);
                break;

            case "thisYear":
                startDate = new Date(today.getFullYear(), 0, 1);
                break;

            case "lastYear":
                startDate = new Date(today.getFullYear() - 1, 0, 1);
                endDate = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
                break;

            case "all":
                window.location.href = "/admin/saleReport";
                return;

            default:
                return;
        }

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");

            return `${year}-${month}-${day}`;
        };

        const formattedStartDate = formatDate(startDate);
        const formattedEndDate = formatDate(endDate);

        window.location.href =
            `/admin/saleReport/?startDate=${formattedStartDate}&endDate=${formattedEndDate}`;
    });
});

document.getElementById("filterOrdersBtn").addEventListener("click", () => {

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;


    if (!startDate || !endDate) {
        alert("Please select both start and end dates.");
        return;
    }

    window.location.href = `/admin/saleReport/?startDate=${startDate}&endDate=${endDate}`;
});

document.getElementById('downloadPDF').addEventListener('click', async () => {
    try {
        // Show loading alert
        Swal.fire({
            title: 'Processing...',
            text: 'Generating your PDF, please wait.',
            icon: 'info',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            },
        });

        const salesCount = document.getElementById("sales-count")?.innerText;
        const salesAmount = document.getElementById("sales-amount")?.innerText;
        const salesDiscount = document.getElementById("sales-discount")?.innerText;
        const tableData = Array.from(document.querySelectorAll('#order-list tr')).map((row) => {
            const cells = row.querySelectorAll('td');
            return {
                orderId: cells[0]?.innerText,
                date: cells[1]?.innerText,
                user: cells[2]?.innerText,
                items: cells[3]?.innerText,
                totalAmount: cells[4]?.innerText,
                offerAmount: cells[5]?.innerText,
                coupenAmound: cells[6]?.innerText,
                paymentMethod: cells[7]?.innerText,
            };
        });

        const response = await fetch('/admin/sales-report/pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ salesData: tableData, salesCount, salesAmount, salesDiscount }),
        });

        if (!response.ok) {
            throw new Error('Failed to download PDF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sales-report.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();

        // Release the object URL after download
        URL.revokeObjectURL(url);

        // Close the loading alert and show success
        Swal.close();
        Swal.fire({
            title: 'Success!',
            text: 'Your PDF has been successfully downloaded.',
            icon: 'success',
        });
    } catch (error) {
        console.error('Error downloading PDF:', error);

        // Close the loading alert and show error
        Swal.close();
        Swal.fire({
            title: 'Error',
            text: 'There was an issue downloading the PDF. Please try again.',
            icon: 'error',
        });
    }
});

document.getElementById('downloadExcel').addEventListener('click', async () => {
    try {
        // Show loading alert
        Swal.fire({
            title: 'Processing...',
            text: 'Generating your Excel report, please wait.',
            icon: 'info',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            },
        });



        // Collect data from the table
        const tableData = Array.from(document.querySelectorAll('#order-list tr')).map((row) => {
            const cells = row.querySelectorAll('td');
            return {
                orderId: cells[0]?.innerText,
                date: cells[1]?.innerText,
                user: cells[2]?.innerText,
                items: cells[3]?.innerText,
                totalAmount: cells[4]?.innerText,
                offerAmount: cells[5]?.innerText,
                couponAmount: cells[6]?.innerText,
                paymentMethod: cells[7]?.innerText,
            };
        });

        // Send the data to the server
        const response = await fetch('/admin/sales-report/excel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },

            body: JSON.stringify({ salesData: tableData }),
        });

        if (!response.ok) {
            throw new Error('Failed to generate Excel file');
        }

        // Download the generated Excel file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sales-report.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();

        // Release the object URL after download
        URL.revokeObjectURL(url);

        // Show success message
        Swal.close();
        Swal.fire({
            title: 'Success!',
            text: 'Your Excel report has been successfully downloaded.',
            icon: 'success',
        });
    } catch (error) {
        console.error('Error downloading Excel file:', error);

        // Show error message
        Swal.close();
        Swal.fire({
            title: 'Error',
            text: 'There was an issue downloading the Excel file. Please try again.',
            icon: 'error',
        });
    }
});