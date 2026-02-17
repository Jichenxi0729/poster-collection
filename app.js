class Database {
    constructor() {
        this.dbName = 'PosterCollection';
        this.storeName = 'works';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('title', 'title', { unique: false });
                    store.createIndex('year', 'year', { unique: false });
                }
            };
        });
    }

    async add(work) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(work);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(work) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(work);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

class App {
    constructor() {
        this.db = new Database();
        this.works = [];
        this.currentPhotos = [];
        this.editingId = null;
        this.importData = [];
        this.filters = {
            search: '',
            year: '',
            character: '',
            identity: ''
        };
        // 图片查看器相关
        this.viewerData = {
            photos: [],
            currentIndex: 0,
            scale: 1,
            position: { x: 0, y: 0 },
            isDragging: false,
            startPos: { x: 0, y: 0 }
        };
    }

    async init() {
        await this.db.init();
        await this.loadWorks();
        this.bindEvents();
        this.render();
    }

    async loadWorks() {
        this.works = await this.db.getAll();
        this.updateYearFilter();
    }

    updateYearFilter() {
        const yearFilter = document.getElementById('yearFilter');
        const years = [...new Set(this.works.map(w => w.year))].sort((a, b) => b - a);
        yearFilter.innerHTML = '<option value="">全部年份</option>';
        years.forEach(year => {
            yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
        });
    }

    bindEvents() {
        document.getElementById('addBtn').addEventListener('click', () => this.openForm());
        document.getElementById('closeModal').addEventListener('click', () => this.closeForm());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeForm());
        document.getElementById('workForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('photoInput').addEventListener('change', (e) => this.handlePhotoSelect(e));
        document.getElementById('filterToggle').addEventListener('click', () => this.toggleAdvancedFilters());
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());
        document.getElementById('searchInput').addEventListener('input', () => this.handleSearch());
        document.getElementById('yearFilter').addEventListener('change', () => this.handleSearch());
        document.getElementById('closeDetail').addEventListener('click', () => this.closeDetail());
        document.getElementById('editBtn').addEventListener('click', () => this.editCurrent());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteCurrent());
        
        document.getElementById('importBtn').addEventListener('click', () => this.openImportModal());
        document.getElementById('closeImport').addEventListener('click', () => this.closeImportModal());
        document.getElementById('cancelImport').addEventListener('click', () => this.closeImportModal());
        document.getElementById('importFileInput').addEventListener('change', (e) => this.handleImportFile(e));
        document.getElementById('confirmImport').addEventListener('click', () => this.confirmImport());
        document.getElementById('downloadTemplate').addEventListener('click', () => this.downloadTemplate());
        
        // 图片查看器事件
        document.getElementById('closeViewer').addEventListener('click', () => this.closeImageViewer());
        document.getElementById('prevImage').addEventListener('click', () => this.showPrevImage());
        document.getElementById('nextImage').addEventListener('click', () => this.showNextImage());
        
        // 图片容器事件
        const imageContainer = document.querySelector('.image-container');
        imageContainer.addEventListener('mousedown', (e) => this.startDrag(e));
        imageContainer.addEventListener('mousemove', (e) => this.drag(e));
        imageContainer.addEventListener('mouseup', () => this.endDrag());
        imageContainer.addEventListener('mouseleave', () => this.endDrag());
        
        // 触摸事件
        imageContainer.addEventListener('touchstart', (e) => this.startDrag(e));
        imageContainer.addEventListener('touchmove', (e) => this.drag(e));
        imageContainer.addEventListener('touchend', () => this.endDrag());
        
        // 滚轮缩放
        imageContainer.addEventListener('wheel', (e) => this.zoom(e));
        
        // 双击缩放
        const viewerImage = document.getElementById('viewerImage');
        viewerImage.addEventListener('dblclick', (e) => this.doubleClickZoom(e));
    }

    toggleAdvancedFilters() {
        const filters = document.getElementById('advancedFilters');
        filters.classList.toggle('hidden');
    }

    handleSearch() {
        this.filters.search = document.getElementById('searchInput').value;
        this.filters.year = document.getElementById('yearFilter').value;
        this.render();
    }

    applyFilters() {
        this.filters.character = document.getElementById('characterFilter').value;
        this.filters.identity = document.getElementById('identityFilter').value;
        this.render();
    }

    resetFilters() {
        document.getElementById('characterFilter').value = '';
        document.getElementById('identityFilter').value = '';
        this.filters.character = '';
        this.filters.identity = '';
        this.render();
    }

    getFilteredWorks() {
        return this.works.filter(work => {
            const searchMatch = !this.filters.search || 
                work.title.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                (work.character && work.character.toLowerCase().includes(this.filters.search.toLowerCase()));
            const yearMatch = !this.filters.year || work.year == this.filters.year;
            const charMatch = !this.filters.character || 
                (work.character && work.character.toLowerCase().includes(this.filters.character.toLowerCase()));
            const idMatch = !this.filters.identity || 
                (work.identity && work.identity.toLowerCase().includes(this.filters.identity.toLowerCase()));
            return searchMatch && yearMatch && charMatch && idMatch;
        }).sort((a, b) => b.id - a.id);
    }

    render() {
        const filtered = this.getFilteredWorks();
        const grid = document.getElementById('cardGrid');
        const empty = document.getElementById('emptyState');

        if (filtered.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            grid.innerHTML = filtered.map(work => this.renderCard(work)).join('');
            
            grid.querySelectorAll('.card').forEach(card => {
                card.addEventListener('click', () => this.openDetail(parseInt(card.dataset.id)));
            });
        }
    }

    renderCard(work) {
        const hasPhoto = work.photos && work.photos.length > 0;
        const photo = hasPhoto ? work.photos[0] : '';
        const tags = [];
        if (work.year) tags.push(work.year);
        if (work.character) tags.push(work.character);
        if (work.identity) tags.push(work.identity);
        
        return `
            <div class="card" data-id="${work.id}">
                ${hasPhoto 
                    ? `<img src="${photo}" class="card-image" alt="${work.title}">`
                    : `<div class="card-image card-image-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                       </div>`
                }
                <div class="card-content">
                    <h3 class="card-title">${work.title}${!hasPhoto ? ' <span class="no-photo-badge">待添加剧照</span>' : ''}</h3>
                    <div class="card-meta">
                        ${tags.map(tag => `<span class="card-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    openForm(work = null) {
        this.editingId = work ? work.id : null;
        this.currentPhotos = work ? [...work.photos] : [];
        
        document.getElementById('modalTitle').textContent = work ? '编辑作品' : '添加作品';
        document.getElementById('workId').value = work ? work.id : '';
        document.getElementById('title').value = work ? work.title : '';
        document.getElementById('year').value = work ? work.year : '';
        document.getElementById('episode').value = work ? work.episode : '';
        document.getElementById('character').value = work ? work.character : '';
        document.getElementById('identity').value = work ? work.identity : '';
        document.getElementById('timestamp').value = work ? work.timestamp : '';
        
        this.renderPhotoPreview();
        document.getElementById('formModal').classList.remove('hidden');
    }

    closeForm() {
        document.getElementById('formModal').classList.add('hidden');
        document.getElementById('workForm').reset();
        this.currentPhotos = [];
        this.editingId = null;
    }

    handlePhotoSelect(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                this.currentPhotos.push(event.target.result);
                this.renderPhotoPreview();
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    }

    renderPhotoPreview() {
        const container = document.getElementById('photoPreview');
        container.innerHTML = this.currentPhotos.map((photo, index) => `
            <div class="preview-item">
                <img src="${photo}">
                <button class="preview-delete" onclick="app.removePhoto(${index})">&times;</button>
            </div>
        `).join('');
    }

    removePhoto(index) {
        this.currentPhotos.splice(index, 1);
        this.renderPhotoPreview();
    }

    async handleSubmit(e) {
        e.preventDefault();

        const work = {
            title: document.getElementById('title').value,
            year: parseInt(document.getElementById('year').value),
            episode: document.getElementById('episode').value ? parseInt(document.getElementById('episode').value) : null,
            character: document.getElementById('character').value,
            identity: document.getElementById('identity').value,
            timestamp: document.getElementById('timestamp').value,
            photos: this.currentPhotos,
            createdAt: new Date().toISOString()
        };

        if (this.editingId) {
            const existing = await this.db.getById(this.editingId);
            work.id = this.editingId;
            work.createdAt = existing.createdAt;
            await this.db.update(work);
        } else {
            await this.db.add(work);
        }

        await this.loadWorks();
        this.render();
        this.closeForm();
    }

    async openDetail(id) {
        const work = await this.db.getById(id);
        this.currentDetailId = id;
        
        document.getElementById('detailTitle').textContent = work.title;
        
        const infoRows = [
            { label: '年份', value: work.year },
            { label: '集数', value: work.episode },
            { label: '人物', value: work.character },
            { label: '身份', value: work.identity },
            { label: '时间戳', value: work.timestamp }
        ].filter(row => row.value);

        const hasPhotos = work.photos && work.photos.length > 0;

        document.getElementById('detailContent').innerHTML = `
            <div class="detail-info">
                ${infoRows.map(row => `
                    <div class="detail-info-row">
                        <span class="detail-label">${row.label}</span>
                        <span>${row.value}</span>
                    </div>
                `).join('')}
            </div>
            ${hasPhotos 
                ? `<div class="detail-gallery">
                    ${work.photos.map(photo => `<img src="${photo}" data-photo="${photo}">`).join('')}
                   </div>`
                : `<div class="no-photos-placeholder">
                    <p>暂无剧照，点击「编辑」添加</p>
                   </div>`
            }
        `;

        // 为图片添加点击事件
        if (hasPhotos) {
            const gallery = document.querySelector('.detail-gallery');
            gallery.querySelectorAll('img').forEach((img, index) => {
                img.addEventListener('click', () => this.openImageViewer(work.photos, index));
            });
        }

        document.getElementById('detailModal').classList.remove('hidden');
    }

    closeDetail() {
        document.getElementById('detailModal').classList.add('hidden');
    }

    async editCurrent() {
        const work = await this.db.getById(this.currentDetailId);
        this.closeDetail();
        this.openForm(work);
    }

    async deleteCurrent() {
        if (confirm('确定要删除这个作品吗？')) {
            await this.db.delete(this.currentDetailId);
            await this.loadWorks();
            this.render();
            this.closeDetail();
        }
    }

    openImportModal() {
        this.importData = [];
        document.getElementById('importPreview').classList.add('hidden');
        document.getElementById('confirmImport').disabled = true;
        document.getElementById('importFileInput').value = '';
        document.getElementById('importModal').classList.remove('hidden');
    }

    closeImportModal() {
        document.getElementById('importModal').classList.add('hidden');
        this.importData = [];
    }

    handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                let data;
                if (file.name.endsWith('.csv')) {
                    data = this.parseCSV(event.target.result);
                } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    data = this.parseExcel(event.target.result);
                } else {
                    alert('不支持的文件格式');
                    return;
                }
                this.importData = data;
                this.renderImportPreview();
            } catch (error) {
                alert('文件解析失败：' + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    parseCSV(csvText) {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(csvText instanceof ArrayBuffer ? csvText : new TextEncoder().encode(csvText));
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] || '';
            });
            data.push(this.mapRowToWork(row));
        }

        return data.filter(item => item.title && item.year);
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    parseExcel(arrayBuffer) {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (json.length < 2) return [];

        const headers = json[0].map(h => String(h || '').trim());
        const data = [];

        for (let i = 1; i < json.length; i++) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = json[i][index] !== undefined ? String(json[i][index]).trim() : '';
            });
            data.push(this.mapRowToWork(row));
        }

        return data.filter(item => item.title && item.year);
    }

    mapRowToWork(row) {
        const getValue = (keys) => {
            for (const key of keys) {
                if (row[key] !== undefined && row[key] !== null) {
                    return String(row[key]).trim();
                }
            }
            return '';
        };

        return {
            title: getValue(['剧名', 'title', 'Title', '剧名']),
            year: parseInt(getValue(['年份', 'year', 'Year', '年份'])) || null,
            episode: parseInt(getValue(['集数', 'episode', 'Episode', '集数'])) || null,
            character: getValue(['人物', 'character', 'Character', '人物']),
            identity: getValue(['身份', 'identity', 'Identity', '身份']),
            timestamp: getValue(['时间戳', 'timestamp', 'Timestamp', '时间戳']),
            photos: []
        };
    }

    renderImportPreview() {
        const preview = document.getElementById('importPreview');
        const table = document.querySelector('.preview-table');
        const count = document.querySelector('.import-count');
        const confirmBtn = document.getElementById('confirmImport');

        if (this.importData.length === 0) {
            alert('没有有效的数据，请检查文件格式');
            return;
        }

        const headers = ['剧名', '年份', '集数', '人物', '身份', '时间戳'];
        const previewData = this.importData.slice(0, 10);

        table.innerHTML = `
            <thead>
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${previewData.map(item => `
                    <tr>
                        <td>${item.title || '-'}</td>
                        <td>${item.year || '-'}</td>
                        <td>${item.episode || '-'}</td>
                        <td>${item.character || '-'}</td>
                        <td>${item.identity || '-'}</td>
                        <td>${item.timestamp || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        count.textContent = `共 ${this.importData.length} 条数据`;
        preview.classList.remove('hidden');
        confirmBtn.disabled = false;
    }

    async confirmImport() {
        if (this.importData.length === 0) return;

        const confirmed = confirm(`确定导入 ${this.importData.length} 条数据吗？`);
        if (!confirmed) return;

        try {
            for (const work of this.importData) {
                work.createdAt = new Date().toISOString();
                await this.db.add(work);
            }
            await this.loadWorks();
            this.render();
            this.closeImportModal();
            alert(`成功导入 ${this.importData.length} 条数据！`);
        } catch (error) {
            alert('导入失败：' + error.message);
        }
    }

    downloadTemplate() {
        const headers = ['剧名', '年份', '集数', '人物', '身份', '时间戳'];
        const sampleData = [
            ['示例电视剧', '2024', '1', '张三', '主角', '00:15:30'],
            ['另一部剧', '2023', '5', '李四', '配角', '01:02:30']
        ];

        const csvContent = [headers, ...sampleData]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = '剧照导入模板.csv';
        link.click();
    }

    // 图片查看器方法
    openImageViewer(photos, index = 0) {
        this.viewerData.photos = photos;
        this.viewerData.currentIndex = index;
        this.resetViewer();
        this.updateViewer();
        document.getElementById('imageViewer').classList.remove('hidden');
    }

    closeImageViewer() {
        document.getElementById('imageViewer').classList.add('hidden');
        this.resetViewer();
    }

    showPrevImage() {
        if (this.viewerData.currentIndex > 0) {
            this.viewerData.currentIndex--;
            this.resetViewer();
            this.updateViewer();
        }
    }

    showNextImage() {
        if (this.viewerData.currentIndex < this.viewerData.photos.length - 1) {
            this.viewerData.currentIndex++;
            this.resetViewer();
            this.updateViewer();
        }
    }

    updateViewer() {
        const image = document.getElementById('viewerImage');
        const counter = document.getElementById('imageCounter');
        const prevBtn = document.getElementById('prevImage');
        const nextBtn = document.getElementById('nextImage');

        // 更新图片
        image.src = this.viewerData.photos[this.viewerData.currentIndex];
        
        // 更新计数器
        counter.textContent = `${this.viewerData.currentIndex + 1} / ${this.viewerData.photos.length}`;
        
        // 更新按钮状态
        prevBtn.disabled = this.viewerData.currentIndex === 0;
        nextBtn.disabled = this.viewerData.currentIndex === this.viewerData.photos.length - 1;
        
        // 更新图片样式
        this.updateImageStyle();
    }

    resetViewer() {
        this.viewerData.scale = 1;
        this.viewerData.position = { x: 0, y: 0 };
        this.viewerData.isDragging = false;
    }

    updateImageStyle() {
        const image = document.getElementById('viewerImage');
        image.style.transform = `translate(${this.viewerData.position.x}px, ${this.viewerData.position.y}px) scale(${this.viewerData.scale})`;
    }

    startDrag(e) {
        e.preventDefault();
        this.viewerData.isDragging = true;
        
        if (e.type === 'touchstart') {
            this.viewerData.startPos.x = e.touches[0].clientX - this.viewerData.position.x;
            this.viewerData.startPos.y = e.touches[0].clientY - this.viewerData.position.y;
        } else {
            this.viewerData.startPos.x = e.clientX - this.viewerData.position.x;
            this.viewerData.startPos.y = e.clientY - this.viewerData.position.y;
        }
    }

    drag(e) {
        if (!this.viewerData.isDragging) return;
        e.preventDefault();
        
        if (e.type === 'touchmove') {
            this.viewerData.position.x = e.touches[0].clientX - this.viewerData.startPos.x;
            this.viewerData.position.y = e.touches[0].clientY - this.viewerData.startPos.y;
        } else {
            this.viewerData.position.x = e.clientX - this.viewerData.startPos.x;
            this.viewerData.position.y = e.clientY - this.viewerData.startPos.y;
        }
        
        this.updateImageStyle();
    }

    endDrag() {
        this.viewerData.isDragging = false;
    }

    zoom(e) {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.viewerData.scale *= scaleFactor;
        
        // 限制缩放范围
        this.viewerData.scale = Math.max(0.5, Math.min(this.viewerData.scale, 3));
        
        this.updateImageStyle();
    }

    doubleClickZoom(e) {
        e.preventDefault();
        if (this.viewerData.scale === 1) {
            // 放大到2倍
            this.viewerData.scale = 2;
        } else {
            // 重置到1倍
            this.resetViewer();
        }
        this.updateImageStyle();
    }
}

const app = new App();
app.init();