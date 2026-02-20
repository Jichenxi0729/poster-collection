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
            startPos: { x: 0, y: 0 },
            // 双指缩放相关
            isPinching: false,
            startDistance: 0,
            startScale: 1
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
        
        // 导出按钮事件
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        // 图片总览按钮事件
        document.getElementById('galleryBtn').addEventListener('click', () => this.openGallery());
        
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
        // 重新渲染整个主内容区域
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div id="filterBar" class="filter-bar">
                <input type="text" id="searchInput" placeholder="搜索剧名、人物..." class="search-input">
                <select id="yearFilter" class="filter-select">
                    <option value="">全部年份</option>
                </select>
                <button id="filterToggle" class="btn btn-secondary">筛选</button>
            </div>

            <div id="advancedFilters" class="advanced-filters hidden">
                <input type="text" id="characterFilter" placeholder="人物" class="filter-input">
                <input type="text" id="identityFilter" placeholder="身份" class="filter-input">
                <button id="applyFilters" class="btn btn-primary">应用筛选</button>
                <button id="resetFilters" class="btn btn-secondary">重置</button>
            </div>

            <div id="cardGrid" class="card-grid"></div>
            <div id="emptyState" class="empty-state hidden">
                <p>还没有剧照，点击右上角添加第一张吧！</p>
            </div>
        `;
        
        // 更新年份过滤器
        this.updateYearFilter();
        
        // 重新绑定事件
        this.bindFilterEvents();
        
        // 渲染卡片
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

    bindFilterEvents() {
        // 重新绑定筛选相关的事件
        document.getElementById('filterToggle').addEventListener('click', () => this.toggleAdvancedFilters());
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());
        document.getElementById('searchInput').addEventListener('input', () => this.handleSearch());
        document.getElementById('yearFilter').addEventListener('change', () => this.handleSearch());
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
            <div class="preview-item" draggable="true" data-index="${index}">
                <img src="${photo}">
                <button class="preview-delete" onclick="app.removePhoto(${index})">&times;</button>
                <span class="preview-index">${index + 1}</span>
            </div>
        `).join('');
        
        // 添加拖拽事件监听
        container.querySelectorAll('.preview-item').forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleDragStart(e));
            item.addEventListener('dragover', (e) => this.handleDragOver(e));
            item.addEventListener('drop', (e) => this.handleDrop(e));
        });
    }

    handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.index);
        e.target.classList.add('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.target.classList.add('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const targetIndex = parseInt(e.target.closest('.preview-item').dataset.index);
        
        if (sourceIndex !== targetIndex) {
            // 重新排序
            const [movedPhoto] = this.currentPhotos.splice(sourceIndex, 1);
            this.currentPhotos.splice(targetIndex, 0, movedPhoto);
            this.renderPhotoPreview();
        }
        
        // 清理样式
        document.querySelectorAll('.preview-item').forEach(item => {
            item.classList.remove('dragging', 'drag-over');
        });
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

        if (file.name.endsWith('.zip')) {
            // 处理ZIP文件
            this.handleZipImport(file);
        } else if (file.name.endsWith('.json')) {
            // 处理普通JSON文件
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const jsonText = event.target.result;
                    const parsedData = JSON.parse(jsonText);
                    this.importData = parsedData.works || [];
                    this.renderImportPreview();
                } catch (error) {
                    alert('文件解析失败：' + error.message);
                }
            };
            reader.readAsText(file, 'utf-8');
        } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // 处理原有格式
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let data;
                    if (file.name.endsWith('.csv')) {
                        data = this.parseCSV(event.target.result);
                    } else {
                        data = this.parseExcel(event.target.result);
                    }
                    this.importData = data;
                    this.renderImportPreview();
                } catch (error) {
                    alert('文件解析失败：' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert('不支持的文件格式');
        }
    }

    // 处理ZIP导入
    handleZipImport(zipFile) {
        // 显示导入进度
        const progress = document.createElement('div');
        progress.style.position = 'fixed';
        progress.style.top = '50%';
        progress.style.left = '50%';
        progress.style.transform = 'translate(-50%, -50%)';
        progress.style.background = 'rgba(0, 0, 0, 0.8)';
        progress.style.color = 'white';
        progress.style.padding = '20px';
        progress.style.borderRadius = '8px';
        progress.style.zIndex = '1000';
        progress.textContent = '正在解析压缩文件...';
        document.body.appendChild(progress);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const zip = new JSZip();
            zip.loadAsync(event.target.result)
                .then(zipContent => {
                    // 查找data.json文件
                    zipContent.file('data.json').async('string')
                        .then(content => {
                            try {
                                const parsedData = JSON.parse(content);
                                this.importData = parsedData.works || [];
                                this.renderImportPreview();
                            } catch (error) {
                                alert('ZIP文件中的数据解析失败：' + error.message);
                            }
                        })
                        .catch(error => {
                            alert('ZIP文件中未找到data.json文件：' + error.message);
                        })
                        .finally(() => {
                            document.body.removeChild(progress);
                        });
                })
                .catch(error => {
                    alert('ZIP文件加载失败：' + error.message);
                    document.body.removeChild(progress);
                });
        };
        reader.readAsArrayBuffer(zipFile);
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

        // 检查DOM元素是否存在
        if (!preview || !table || !count || !confirmBtn) {
            console.error('导入预览所需的DOM元素不存在');
            alert('导入预览初始化失败，请重试');
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
            let importedCount = 0;
            
            for (const work of this.importData) {
                // 保留原始的createdAt（如果有）
                if (!work.createdAt) {
                    work.createdAt = new Date().toISOString();
                }
                
                // 移除id属性，让数据库自动分配
                delete work.id;
                
                await this.db.add(work);
                importedCount++;
            }
            
            await this.loadWorks();
            this.render();
            this.closeImportModal();
            alert(`成功导入 ${importedCount} 条数据！`);
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
        
        // 处理触摸事件
        if (e.type === 'touchstart') {
            // 双指触摸 - 开始缩放
            if (e.touches.length === 2) {
                this.viewerData.isPinching = true;
                this.viewerData.startDistance = this.getDistance(e.touches[0], e.touches[1]);
                this.viewerData.startScale = this.viewerData.scale;
            }
            // 单指触摸 - 开始拖动
            else if (e.touches.length === 1 && !this.viewerData.isPinching) {
                this.viewerData.isDragging = true;
                this.viewerData.startPos.x = e.touches[0].clientX - this.viewerData.position.x;
                this.viewerData.startPos.y = e.touches[0].clientY - this.viewerData.position.y;
            }
        }
        // 处理鼠标事件
        else {
            this.viewerData.isDragging = true;
            this.viewerData.startPos.x = e.clientX - this.viewerData.position.x;
            this.viewerData.startPos.y = e.clientY - this.viewerData.position.y;
        }
    }

    drag(e) {
        e.preventDefault();
        
        // 处理双指缩放
        if (e.type === 'touchmove' && e.touches.length === 2) {
            this.viewerData.isPinching = true;
            const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
            const scaleFactor = currentDistance / this.viewerData.startDistance;
            this.viewerData.scale = this.viewerData.startScale * scaleFactor;
            
            // 限制缩放范围
            this.viewerData.scale = Math.max(0.5, Math.min(this.viewerData.scale, 3));
            this.updateImageStyle();
            return;
        }
        
        // 处理拖动
        if (this.viewerData.isDragging && !this.viewerData.isPinching) {
            if (e.type === 'touchmove') {
                this.viewerData.position.x = e.touches[0].clientX - this.viewerData.startPos.x;
                this.viewerData.position.y = e.touches[0].clientY - this.viewerData.startPos.y;
            } else {
                this.viewerData.position.x = e.clientX - this.viewerData.startPos.x;
                this.viewerData.position.y = e.clientY - this.viewerData.startPos.y;
            }
            
            this.updateImageStyle();
        }
    }

    endDrag() {
        this.viewerData.isDragging = false;
        this.viewerData.isPinching = false;
    }

    // 计算两点之间的距离
    getDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
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

    async exportData() {
        try {
            // 显示导出选项
            const useCompression = confirm('检测到您的数据较大，是否使用压缩模式导出？\n\n压缩模式：\n• 减少文件体积约70%\n• 适合大型图片集合\n• 导出时间稍长\n\n普通模式：\n• 保持原始数据质量\n• 适合小型集合\n• 导出速度快');
            
            // 获取所有作品数据
            const allWorks = await this.db.getAll();
            
            // 图片处理选项
            const options = {
                compressImages: useCompression,
                maxWidth: 1920,
                quality: 0.7
            };
            
            // 处理图片
            if (options.compressImages && allWorks.length > 0) {
                // 显示处理进度
                const progress = document.createElement('div');
                progress.style.position = 'fixed';
                progress.style.top = '50%';
                progress.style.left = '50%';
                progress.style.transform = 'translate(-50%, -50%)';
                progress.style.background = 'rgba(0, 0, 0, 0.8)';
                progress.style.color = 'white';
                progress.style.padding = '20px';
                progress.style.borderRadius = '8px';
                progress.style.zIndex = '1000';
                progress.textContent = '正在处理图片... 0%';
                document.body.appendChild(progress);
                
                // 分批次处理图片
                const totalWorks = allWorks.length;
                for (let i = 0; i < totalWorks; i++) {
                    const work = allWorks[i];
                    if (work.photos && work.photos.length > 0) {
                        work.photos = await Promise.all(
                            work.photos.map(photo => this.compressImage(photo, options.maxWidth, options.quality))
                        );
                    }
                    
                    // 更新进度
                    const percent = Math.round((i + 1) / totalWorks * 100);
                    progress.textContent = `正在处理图片... ${percent}%`;
                }
                
                // 移除进度条
                document.body.removeChild(progress);
            }
            
            // 创建导出数据对象
            const exportData = {
                version: '1.1',
                exportDate: new Date().toISOString(),
                totalWorks: allWorks.length,
                options: options,
                works: allWorks
            };
            
            if (useCompression) {
                // 使用JSZip压缩
                const zip = new JSZip();
                zip.file('data.json', JSON.stringify(exportData, null, 2));
                
                // 生成ZIP文件并下载
                zip.generateAsync({ type: 'blob' })
                    .then(blob => {
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `剧照收集导出_${new Date().toISOString().split('T')[0]}.zip`;
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(link.href), 100);
                        alert(`成功导出 ${allWorks.length} 个作品的数据！`);
                    });
            } else {
                // 普通JSON导出
                const jsonString = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `剧照收集导出_${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(link.href), 100);
                alert(`成功导出 ${allWorks.length} 个作品的数据！`);
            }
        } catch (error) {
            alert('导出失败：' + error.message);
        }
    }

    // 图片压缩方法
    compressImage(imageData, maxWidth = 1920, quality = 0.7) {
        return new Promise((resolve) => {
            // 跳过非Data URL格式
            if (!imageData.startsWith('data:image/')) {
                resolve(imageData);
                return;
            }
            
            const canvas = document.createElement('canvas');
            const img = new Image();
            img.onload = () => {
                // 计算新尺寸
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                
                // 绘制并压缩
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为Data URL
                const compressedData = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedData);
            };
            img.src = imageData;
        });
    }

    async openGallery() {
        // 收集所有图片
        const allWorks = await this.db.getAll();
        const allPhotos = [];
        
        allWorks.forEach(work => {
            if (work.photos && work.photos.length > 0) {
                work.photos.forEach(photo => {
                    allPhotos.push({
                        id: `${work.id}_${allPhotos.length}`,
                        photo: photo,
                        title: work.title,
                        year: work.year,
                        character: work.character
                    });
                });
            }
        });
        
        // 创建图片总览页面
        this.renderGallery(allPhotos);
    }

    renderGallery(photos) {
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="gallery-header">
                <h2>图片总览</h2>
                <p>共 ${photos.length} 张图片</p>
                <button id="backToMain" class="btn btn-secondary">返回主页</button>
            </div>
            <div class="gallery-grid">
                ${photos.map(item => `
                    <div class="gallery-item" data-photo="${item.photo}">
                        <div class="gallery-item-loader"></div>
                        <img data-src="${item.photo}" alt="${item.title}" class="lazy-load">
                    </div>
                `).join('')}
            </div>
        `;
        
        // 添加返回按钮事件
        document.getElementById('backToMain').addEventListener('click', () => this.render());
        
        // 实现图片懒加载
        this.initLazyLoading();
        
        // 添加图片点击事件
        mainContent.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const photo = item.dataset.photo;
                this.openImageViewer([photo], 0);
            });
        });
    }

    initLazyLoading() {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    
                    if (src) {
                        // 添加图片加载错误处理
                        img.onerror = function() {
                            this.style.opacity = '0.5';
                            this.alt = '图片加载失败';
                            
                            // 移除加载状态
                            const loader = this.previousElementSibling;
                            if (loader && loader.classList.contains('gallery-item-loader')) {
                                loader.remove();
                            }
                        };
                        
                        img.onload = function() {
                            this.classList.remove('lazy-load');
                            
                            // 移除加载状态
                            const loader = this.previousElementSibling;
                            if (loader && loader.classList.contains('gallery-item-loader')) {
                                loader.remove();
                            }
                        };
                        
                        img.src = src;
                    }
                    
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '200px 0px', // 提前200px开始加载
            threshold: 0.1
        });
        
        document.querySelectorAll('.lazy-load').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

const app = new App();
app.init();