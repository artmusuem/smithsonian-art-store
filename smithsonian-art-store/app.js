// Smithsonian Art Store - Main Application
const API_BASE = 'https://api.si.edu/openaccess/api/v1.0';
const API_KEY = 'gXkqVSlCTz8ljv2NUcbVVVrBflcbXzmt6pKQUajk';

// Calculate price from artwork ID
function calculatePrice(id) {
    const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return 49 + (hash % 150);
}

// Cart
let cart = JSON.parse(localStorage.getItem('smithsonian-cart') || '[]');
function updateCartCount() {
    const el = document.getElementById('cart-count');
    if (el) el.textContent = cart.length;
}
function addToCart(item) {
    cart.push(item);
    localStorage.setItem('smithsonian-cart', JSON.stringify(cart));
    updateCartCount();
    alert('Added to cart!');
}

// Fetch artworks
async function fetchArtworks(query = 'painting', limit = 12, start = 0) {
    try {
        const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&rows=${limit}&start=${start}&api_key=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.response?.rows) return [];
        
        return data.response.rows
            .filter(item => item.content?.descriptiveNonRepeating)
            .map(item => {
                const desc = item.content.descriptiveNonRepeating;
                const indexed = item.content.indexedStructured || {};
                const freetext = item.content.freetext || {};
                
                let image = '';
                if (desc.online_media?.media?.[0]) {
                    image = desc.online_media.media[0].content || desc.online_media.media[0].thumbnail;
                }
                
                return {
                    id: item.id,
                    title: desc.title?.content || 'Untitled',
                    artist: indexed.name?.[0] || freetext.name?.[0]?.content || 'Unknown Artist',
                    image,
                    price: calculatePrice(item.id),
                    description: freetext.notes?.[0]?.content || '',
                    date: indexed.date?.[0] || '',
                    medium: freetext.physicalDescription?.[0]?.content || ''
                };
            })
            .filter(item => item.image);
    } catch (e) {
        console.error('API Error:', e);
        return [];
    }
}

// Fetch single artwork
async function fetchArtwork(id) {
    try {
        const url = `${API_BASE}/content/${id}?api_key=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.response) return null;
        
        const desc = data.response.content.descriptiveNonRepeating;
        const indexed = data.response.content.indexedStructured || {};
        const freetext = data.response.content.freetext || {};
        
        let image = '';
        if (desc.online_media?.media?.[0]) {
            image = desc.online_media.media[0].content || desc.online_media.media[0].thumbnail;
        }
        
        return {
            id: data.response.id,
            title: desc.title?.content || 'Untitled',
            artist: indexed.name?.[0] || freetext.name?.[0]?.content || 'Unknown Artist',
            image,
            price: calculatePrice(data.response.id),
            description: freetext.notes?.[0]?.content || 'No description available.',
            date: indexed.date?.[0] || '',
            medium: freetext.physicalDescription?.[0]?.content || ''
        };
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

// Render product card
function renderCard(art) {
    return `
        <div class="product-card" onclick="location.href='product.html?id=${encodeURIComponent(art.id)}'">
            <img src="${art.image}" alt="${art.title}" loading="lazy" 
                 onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
            <div class="product-info">
                <h3 class="product-title">${art.title}</h3>
                <p class="product-artist">${art.artist}</p>
                <p class="product-price">From $${art.price}</p>
            </div>
        </div>
    `;
}

// Page initializers
let currentStart = 0;
let currentQuery = 'painting';

async function initHome() {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;
    
    const arts = await fetchArtworks('art portrait landscape', 6);
    grid.innerHTML = arts.length ? arts.map(renderCard).join('') : '<p>Unable to load artworks.</p>';
}

async function initShop() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    
    await loadProducts();
    
    document.getElementById('search-input')?.addEventListener('input', e => {
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            currentQuery = e.target.value || 'painting';
            currentStart = 0;
            loadProducts(true);
        }, 500);
    });
    
    document.getElementById('category-filter')?.addEventListener('change', e => {
        currentQuery = e.target.value || 'painting';
        currentStart = 0;
        loadProducts(true);
    });
    
    document.getElementById('load-more')?.addEventListener('click', () => {
        currentStart += 12;
        loadProducts(false);
    });
}

async function loadProducts(replace = true) {
    const grid = document.getElementById('product-grid');
    const btn = document.getElementById('load-more');
    
    if (replace) grid.innerHTML = '<div class="loading">Loading...</div>';
    
    const arts = await fetchArtworks(currentQuery, 12, currentStart);
    
    if (arts.length) {
        const html = arts.map(renderCard).join('');
        grid.innerHTML = replace ? html : grid.innerHTML + html;
        if (btn) btn.style.display = 'inline-block';
    } else if (replace) {
        grid.innerHTML = '<p>No artworks found.</p>';
        if (btn) btn.style.display = 'none';
    }
}

async function initProduct() {
    const container = document.getElementById('product-detail');
    if (!container) return;
    
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
        container.innerHTML = '<p>Product not found.</p>';
        return;
    }
    
    const art = await fetchArtwork(id);
    if (!art) {
        container.innerHTML = '<p>Unable to load product.</p>';
        return;
    }
    
    document.title = `${art.title} | Smithsonian Art Store`;
    
    container.innerHTML = `
        <div class="product-image">
            <img src="${art.image}" alt="${art.title}">
        </div>
        <div class="product-info-detail">
            <h1>${art.title}</h1>
            <p class="artist">${art.artist}${art.date ? `, ${art.date}` : ''}</p>
            <p class="price" id="display-price">$${art.price}</p>
            
            <div class="option-group">
                <label>Size</label>
                <select id="size-select" onchange="updatePrice()">
                    <option value="0">Small (8×10") - Base Price</option>
                    <option value="30">Medium (16×20") +$30</option>
                    <option value="60">Large (24×30") +$60</option>
                    <option value="100">Extra Large (30×40") +$100</option>
                </select>
            </div>
            
            <div class="option-group">
                <label>Frame</label>
                <select id="frame-select" onchange="updatePrice()">
                    <option value="0">No Frame</option>
                    <option value="45">Black Wood +$45</option>
                    <option value="55">White Wood +$55</option>
                    <option value="75">Gold Ornate +$75</option>
                </select>
            </div>
            
            <button class="btn btn-primary add-to-cart" onclick="addCurrentToCart()">Add to Cart</button>
            
            <div class="description" style="margin-top:30px;">
                <h3>About This Artwork</h3>
                <p>${art.description}</p>
                ${art.medium ? `<p><strong>Medium:</strong> ${art.medium}</p>` : ''}
            </div>
        </div>
    `;
    
    window.currentArt = art;
}

function updatePrice() {
    if (!window.currentArt) return;
    const size = parseInt(document.getElementById('size-select')?.value || 0);
    const frame = parseInt(document.getElementById('frame-select')?.value || 0);
    const total = window.currentArt.price + size + frame;
    document.getElementById('display-price').textContent = `$${total}`;
}

function addCurrentToCart() {
    if (!window.currentArt) return;
    const size = document.getElementById('size-select');
    const frame = document.getElementById('frame-select');
    addToCart({
        ...window.currentArt,
        selectedSize: size?.options[size.selectedIndex]?.text || 'Small',
        selectedFrame: frame?.options[frame.selectedIndex]?.text || 'No Frame',
        finalPrice: parseInt(document.getElementById('display-price')?.textContent.replace('$','') || window.currentArt.price)
    });
}

// Init on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    
    if (document.getElementById('featured-grid')) initHome();
    if (document.getElementById('product-grid')) initShop();
    if (document.getElementById('product-detail')) initProduct();
});
