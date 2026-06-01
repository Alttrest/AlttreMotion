// Default products to load if localStorage is empty
const defaultProducts = [
    {
        id: '1',
        title: 'Özel Tasarım Vazo',
        price: '250',
        desc: 'Mat yüzeyli, geometrik kesim modern dekoratif vazo. İç mekanlara şıklık katar.',
        image: 'https://via.placeholder.com/300/111111/ffffff?text=Vazo'
    },
    {
        id: '2',
        title: 'Mimari Maket',
        price: '1200',
        desc: 'Yüksek hassasiyetli reçine baskı ile üretilmiş, detaylı mimari konsept maket.',
        image: 'https://via.placeholder.com/300/111111/ffffff?text=Maket'
    },
    {
        id: '3',
        title: 'Mekanik Parça',
        price: '450',
        desc: 'Karbon fiber destekli, endüstriyel kullanıma uygun yüksek dayanımlı yedek parça.',
        image: 'https://via.placeholder.com/300/111111/ffffff?text=Parca'
    }
];

// Initialize products from localStorage or defaults
let products = JSON.parse(localStorage.getItem('proff3d_products')) || defaultProducts;

function saveProducts() {
    localStorage.setItem('proff3d_products', JSON.stringify(products));
}

// Render Products to the Grid
function renderProducts() {
    const grid = document.getElementById('products-grid-container');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${p.image}" alt="${p.title}">
            <h3>${p.title}</h3>
            <p class="desc">${p.desc}</p>
            <p class="price">${p.price} TL</p>
        `;
        grid.appendChild(card);
    });
}

// --- Admin Panel Logic ---

document.addEventListener('DOMContentLoaded', () => {
    renderProducts();

    const adminBtn = document.getElementById('admin-login-btn');
    const adminModal = document.getElementById('admin-modal');
    const adminClose = document.getElementById('admin-close');
    const loginSection = document.getElementById('admin-login-section');
    const dashSection = document.getElementById('admin-dash-section');
    const loginBtn = document.getElementById('btn-login-submit');
    const pwdInput = document.getElementById('admin-pwd');
    const addProductForm = document.getElementById('add-product-form');
    const adminProductsList = document.getElementById('admin-products-list');

    if(adminBtn) {
        adminBtn.addEventListener('click', (e) => {
            e.preventDefault();
            adminModal.classList.remove('hidden');
            loginSection.classList.remove('hidden');
            dashSection.classList.add('hidden');
            pwdInput.value = '';
        });
    }

    if(adminClose) {
        adminClose.addEventListener('click', () => {
            adminModal.classList.add('hidden');
        });
    }

    if(loginBtn) {
        loginBtn.addEventListener('click', () => {
            if(pwdInput.value === 'admin123') {
                loginSection.classList.add('hidden');
                dashSection.classList.remove('hidden');
                renderAdminList();
            } else {
                alert('Hatalı Şifre!');
            }
        });
    }

    const imageFileInput = document.getElementById('p-image-file');
    const imageNameLabel = document.getElementById('p-image-name');
    let selectedImageBase64 = null;

    if (imageFileInput) {
        imageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                imageNameLabel.textContent = file.name;
                imageNameLabel.style.color = '#fff';
                
                // Convert file to Base64
                const reader = new FileReader();
                reader.onload = function(event) {
                    selectedImageBase64 = event.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                imageNameLabel.textContent = 'Bilgisayardan Görsel Seç... (İsteğe Bağlı)';
                imageNameLabel.style.color = 'rgba(255,255,255,0.5)';
                selectedImageBase64 = null;
            }
        });
    }

    if(addProductForm) {
        addProductForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const newProduct = {
                id: Date.now().toString(),
                title: document.getElementById('p-title').value,
                desc: document.getElementById('p-desc').value,
                price: document.getElementById('p-price').value,
                image: selectedImageBase64 || 'https://via.placeholder.com/300/111111/ffffff?text=Yeni+Urun'
            };
            
            products.push(newProduct);
            saveProducts();
            renderProducts();
            renderAdminList();
            
            // Reset form
            addProductForm.reset();
            if(imageNameLabel) {
                imageNameLabel.textContent = 'Bilgisayardan Görsel Seç... (İsteğe Bağlı)';
                imageNameLabel.style.color = 'rgba(255,255,255,0.5)';
                selectedImageBase64 = null;
            }
        });
    }

    function renderAdminList() {
        if(!adminProductsList) return;
        adminProductsList.innerHTML = '';
        products.forEach(p => {
            const li = document.createElement('div');
            li.className = 'admin-list-item';
            li.innerHTML = `
                <div class="info">
                    <strong>${p.title}</strong> - ${p.price} TL
                </div>
                <button class="delete-btn" data-id="${p.id}">Sil</button>
            `;
            adminProductsList.appendChild(li);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                products = products.filter(prod => prod.id !== id);
                saveProducts();
                renderProducts();
                renderAdminList();
            });
        });
    }
});
