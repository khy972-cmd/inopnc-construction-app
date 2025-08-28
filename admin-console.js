// 관리자 콘솔 JavaScript
class AdminConsole {
    constructor() {
        this.supabase = null;
        this.workData = [];
        this.expenseData = [];
        this.workers = [];
        this.sites = [];
        this.config = {};
        this.deferredPrompt = null;
        
        this.init();
    }

    async init() {
        this.loadConfig();
        this.setupEventListeners();
        this.setupPWA();
        
        // index.html의 db.workers가 로드될 때까지 대기
        await this.waitForWorkers();
        
        // index.html의 작업자 정보를 가져와서 초기 작업자 목록에 추가
        this.syncWorkersFromIndex();
        
        this.loadStats();
        this.loadWorkers();
        this.loadSites();
        await this.initSupabase();
        


    }

    // index.html의 db.workers가 로드될 때까지 대기
    async waitForWorkers() {
        // index.html과 같은 페이지에서만 db.workers를 기다림
        if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
            return new Promise((resolve) => {
                const checkWorkers = () => {
                    if (window.db && window.db.workers && window.db.workers.length > 0) {
                        console.log('index.html의 작업자 정보 로드 완료:', window.db.workers);
                        resolve();
                    } else {
                        setTimeout(checkWorkers, 100);
                    }
                };
                checkWorkers();
            });
        } else {
            // 별도 페이지에서는 즉시 반환
            return Promise.resolve();
        }
    }

    // index.html의 작업자 정보를 가져와서 동기화
    syncWorkersFromIndex() {
        if (window.db && window.db.workers && window.db.workers.length > 0) {
            console.log('index.html에서 작업자 정보 동기화:', window.db.workers);
            
            // 기존 작업자 목록에 없는 작업자만 추가
            window.db.workers.forEach(indexWorker => {
                const existingWorker = this.workers.find(w => w.name === indexWorker.name);
                if (!existingWorker) {
                    // index.html의 구조에 맞게 변환
                    const newWorker = {
                        id: Date.now() + Math.random(), // 고유 ID 생성
                        name: indexWorker.name,
                        daily: indexWorker.daily || 0,
                        monthlySalary: 0,
                        timestamp: new Date().toISOString()
                    };
                    this.workers.push(newWorker);
                    console.log('새로운 작업자 추가:', newWorker);
                }
            });
            
            // 로컬 스토리지에 저장
            this.saveWorkers();
        }
    }

    setupEventListeners() {
        // 파일 업로드 이벤트
        this.setupFileUpload('workFileInput', 'workUploadArea', this.handleWorkFileUpload.bind(this));
        this.setupFileUpload('expenseFileInput', 'expenseUploadArea', this.handleExpenseFileUpload.bind(this));

        // 드래그 앤 드롭 이벤트
        this.setupDragAndDrop('workUploadArea', this.handleWorkFileUpload.bind(this));
        this.setupDragAndDrop('expenseUploadArea', this.handleExpenseFileUpload.bind(this));

        // PWA 설치 이벤트
        this.setupPWAEvents();
    }

    setupFileUpload(inputId, areaId, handler) {
        const input = document.getElementById(inputId);
        const area = document.getElementById(areaId);

        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handler(e.target.files[0]);
            }
        });
    }

    setupDragAndDrop(areaId, handler) {
        const area = document.getElementById(areaId);

        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });

        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                handler(e.dataTransfer.files[0]);
            }
        });
    }

    async handleWorkFileUpload(file) {
        try {
            this.showWorkProgress();
            const data = await this.parseExcelFile(file);
            
            const validationResult = this.validateWorkDataEnhanced(data);
            if (validationResult.isValid) {
                this.workData = data;
                this.showWorkPreview(data);
                this.showStatus('workStatus', 'success', `작업 데이터 ${data.length}건이 성공적으로 업로드되었습니다.`);
            } else {
                this.showStatus('workStatus', 'error', `작업 데이터 형식이 올바르지 않습니다. 필수 컬럼을 확인해주세요.`);
                this.showValidationErrors(validationResult, 'workStatus');
            }
        } catch (error) {
            this.showStatus('workStatus', 'error', `파일 처리 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            this.hideWorkProgress();
        }
    }

    async handleExpenseFileUpload(file) {
        try {
            this.showExpenseProgress();
            const data = await this.parseExcelFile(file);
            
            const validationResult = this.validateExpenseDataEnhanced(data);
            if (validationResult.isValid) {
                this.expenseData = data;
                this.showExpensePreview(data);
                this.showStatus('expenseStatus', 'success', `경비 데이터 ${data.length}건이 성공적으로 업로드되었습니다.`);
            } else {
                this.showStatus('expenseStatus', 'error', `경비 데이터 형식이 올바르지 않습니다. 필수 컬럼을 확인해주세요.`);
                this.showValidationErrors(validationResult, 'expenseStatus');
            }
        } catch (error) {
            this.showStatus('expenseStatus', 'error', `파일 처리 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            this.hideExpenseProgress();
        }
    }

    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length < 2) {
                        reject(new Error('데이터가 충분하지 않습니다.'));
                        return;
                    }

                    const headers = jsonData[0];
                    const rows = jsonData.slice(1);
                    
                    const result = rows.map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            if (header && row[index] !== undefined) {
                                obj[header] = row[index];
                            }
                        });
                        return obj;
                    }).filter(row => Object.keys(row).length > 0);

                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsArrayBuffer(file);
        });
    }

    validateWorkData(data) {
        if (!Array.isArray(data) || data.length === 0) return false;
        
        const requiredFields = ['현장', '작업자', '공수'];
        const firstRow = data[0];
        
        return requiredFields.every(field => 
            firstRow.hasOwnProperty(field) || 
            Object.keys(firstRow).some(key => key.includes(field))
        );
    }

    validateExpenseData(data) {
        if (!Array.isArray(data) || data.length === 0) return false;
        
        const requiredFields = ['현장', '사용일', '항목', '금액'];
        const firstRow = data[0];
        
        return requiredFields.every(field => 
            firstRow.hasOwnProperty(field) || 
            Object.keys(firstRow).some(key => key.includes(field))
        );
    }

    // 공통 데이터 검증 함수
    validateDataEnhanced(data, config) {
        const validationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            summary: {
                total: data.length,
                valid: 0,
                errors: 0,
                warnings: 0
            }
        };

        if (!Array.isArray(data) || data.length === 0) {
            validationResult.isValid = false;
            validationResult.errors.push('데이터가 비어있습니다.');
            return validationResult;
        }

        data.forEach((row, index) => {
            const rowNumber = index + 2;
            let rowHasError = false;
            let rowHasWarning = false;

            // 필수 필드 검증
            config.requiredFields.forEach(field => {
                if (!row[field] && row[field] !== 0) {
                    validationResult.errors.push(`행 ${rowNumber}: ${field} 필드가 비어있습니다.`);
                    rowHasError = true;
                }
            });

            // 날짜 필드 검증
            const hasDateField = config.dateFields.some(field => row[field]);
            if (!hasDateField) {
                validationResult.errors.push(`행 ${rowNumber}: 날짜 필드가 없습니다.`);
                rowHasError = true;
            }

            // 숫자 필드 검증
            if (config.numericFields) {
                config.numericFields.forEach(field => {
                    if (row[field] && isNaN(parseFloat(row[field]))) {
                        validationResult.errors.push(`행 ${rowNumber}: ${field}는 숫자여야 합니다. (현재: ${row[field]})`);
                        rowHasError = true;
                    }
                });
            }

            // 엔티티 존재 여부 검증
            if (config.entityValidations) {
                config.entityValidations.forEach(validation => {
                    if (row[validation.field] && !validation.validator(row[validation.field])) {
                        validationResult.warnings.push(`행 ${rowNumber}: 등록되지 않은 ${validation.label} "${row[validation.field]}"입니다.`);
                        rowHasWarning = true;
                    }
                });
            }

            if (rowHasError) {
                validationResult.summary.errors++;
            } else if (rowHasWarning) {
                validationResult.summary.warnings++;
            } else {
                validationResult.summary.valid++;
            }
        });

        validationResult.isValid = validationResult.summary.errors === 0;
        return validationResult;
    }

    // 작업 데이터 검증
    validateWorkDataEnhanced(data) {
        return this.validateDataEnhanced(data, {
            requiredFields: ['작업자', '일자', '현장', '공수'],
            dateFields: ['일자', '사용일', '년-월-일', '날짜'],
            numericFields: ['공수'],
            entityValidations: [
                { field: '작업자', label: '작업자', validator: (name) => this.findWorker(name) },
                { field: '현장', label: '현장', validator: (name) => this.findSite(name) }
            ]
        });
    }

    // 경비 데이터 검증
    validateExpenseDataEnhanced(data) {
        return this.validateDataEnhanced(data, {
            requiredFields: ['현장', '사용일', '항목', '금액'],
            dateFields: ['사용일', '날짜'],
            numericFields: ['금액'],
            entityValidations: [
                { field: '현장', label: '현장', validator: (name) => this.findSite(name) }
            ]
        });
    }

    showWorkPreview(data) {
        const preview = document.getElementById('workPreview');
        const tbody = document.querySelector('#workPreviewTable tbody');
        
        tbody.innerHTML = '';
        
        data.slice(0, 10).forEach((row, index) => {
            // 급여 계산 (작업자 일당 기준 × 공수)
            const worker = this.findWorker(row['작업자']);
            const hours = parseFloat(row['공수']) || 0;
            let totalSalary = 0, tax = 0, netSalary = 0;
            
            console.log('작업자 정보:', row['작업자'], worker); // 디버깅 로그
            console.log('공수:', hours); // 디버깅 로그
            
            if (worker && hours > 0) {
                totalSalary = this.calculateSalary(worker, hours);
                tax = Math.round(totalSalary * (this.config.taxRate || 3.3) / 100);
                netSalary = totalSalary - tax;
                
                console.log('급여 계산 결과 (일당 기준):', { totalSalary, tax, netSalary }); // 디버깅 로그
            } else {
                console.log('작업자 정보 없음 또는 공수 0:', { worker, hours }); // 디버깅 로그
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="editable" data-field="작업자" data-index="${index}">${row['작업자'] || ''}</td>
                <td class="editable" data-field="일자" data-index="${index}">${this.formatExcelDate(row['일자'] || row['사용일'] || row['년-월-일'] || row['날짜'] || '')}</td>
                <td class="editable" data-field="현장" data-index="${index}">${row['현장'] || ''}</td>
                <td class="editable" data-field="공수" data-index="${index}">${row['공수'] || ''}</td>
                <td>${totalSalary > 0 ? totalSalary.toLocaleString() + '원' : ''}</td>
                <td>${tax > 0 ? tax.toLocaleString() + '원' : ''}</td>
                <td>${netSalary > 0 ? netSalary.toLocaleString() + '원' : ''}</td>
                <td class="editable" data-field="메모" data-index="${index}">${row['메모'] || ''}</td>
            `;
            
            // 더블클릭 이벤트 추가
            tr.querySelectorAll('.editable').forEach(cell => {
                cell.addEventListener('dblclick', (e) => this.makeCellEditable(e.target));
            });
            
            tbody.appendChild(tr);
        });
        
        if (data.length > 10) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="8" style="text-align: center; color: #6c757d;">... 외 ${data.length - 10}건</td>`;
            tbody.appendChild(tr);
        }
        
        preview.style.display = 'block';
    }

    showExpensePreview(data) {
        const preview = document.getElementById('expensePreview');
        const tbody = document.querySelector('#expensePreviewTable tbody');
        
        tbody.innerHTML = '';
        
        data.slice(0, 10).forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="editable" data-field="현장" data-index="${index}">${row['현장'] || ''}</td>
                <td class="editable" data-field="사용일" data-index="${index}">${row['사용일'] || row['날짜'] || ''}</td>
                <td class="editable" data-field="작업자" data-index="${index}">${row['작업자'] || ''}</td>
                <td class="editable" data-field="항목" data-index="${index}">${row['항목'] || ''}</td>
                <td class="editable" data-field="금액" data-index="${index}">${row['금액'] || ''}</td>
                <td class="editable" data-field="사용처" data-index="${index}">${row['사용처'] || ''}</td>
                <td class="editable" data-field="주소" data-index="${index}">${row['주소'] || ''}</td>
                <td class="editable" data-field="메모" data-index="${index}">${row['메모'] || ''}</td>
            `;
            
            // 더블클릭 이벤트 추가
            tr.querySelectorAll('.editable').forEach(cell => {
                cell.addEventListener('dblclick', (e) => this.makeCellEditable(e.target));
            });
            
            tbody.appendChild(tr);
        });
        
        if (data.length > 10) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="8" style="text-align: center; color: #6c757d;">... 외 ${data.length - 10}건</td>`;
            tbody.appendChild(tr);
        }
        
        preview.style.display = 'block';
    }

    formatCurrency(amount) {
        if (!amount) return '0원';
        const num = parseFloat(amount);
        if (isNaN(num)) return '0원';
        return num.toLocaleString() + '원';
    }

    // 엑셀 날짜 형식을 년-월-일 형식으로 변환
    formatExcelDate(excelDate) {
        if (!excelDate) return '';
        
        // 엑셀 날짜 숫자인 경우 (1900년 1월 1일부터의 일수)
        if (typeof excelDate === 'number') {
            try {
                // 1900년 1월 1일을 기준으로 날짜 계산
                const date = new Date(1900, 0, excelDate - 1);
                return this.formatDate(date);
            } catch (error) {
                console.warn('날짜 변환 실패:', excelDate, error);
                return excelDate.toString();
            }
        }
        
        // 이미 날짜 문자열인 경우
        if (typeof excelDate === 'string') {
            // ISO 형식이나 다른 날짜 형식인지 확인
            const date = new Date(excelDate);
            if (!isNaN(date.getTime())) {
                return this.formatDate(date);
            }
            // 일반 문자열인 경우 그대로 반환
            return excelDate;
        }
        
        // Date 객체인 경우
        if (excelDate instanceof Date) {
            return this.formatDate(excelDate);
        }
        
        return excelDate.toString();
    }

    // 날짜를 년-월-일 형식으로 포맷
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    showWorkProgress() {
        document.getElementById('workProgress').style.display = 'block';
        this.simulateProgress('workProgressFill', 'workProgressText');
    }

    hideWorkProgress() {
        document.getElementById('workProgress').style.display = 'none';
    }

    showExpenseProgress() {
        document.getElementById('expenseProgress').style.display = 'block';
        this.simulateProgress('expenseProgressFill', 'expenseProgressText');
    }

    hideExpenseProgress() {
        document.getElementById('expenseProgress').style.display = 'none';
    }

    simulateProgress(progressId, textId) {
        const progress = document.getElementById(progressId);
        const text = document.getElementById(textId);
        let width = 0;
        
        const interval = setInterval(() => {
            if (width >= 100) {
                clearInterval(interval);
            } else {
                width++;
                progress.style.width = width + '%';
                text.textContent = `업로드 진행 중... ${width}%`;
            }
        }, 50);
    }

    showStatus(elementId, type, message) {
        const element = document.getElementById(elementId);
        element.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
    }

    async processWorkData() {
        if (!this.workData.length) {
            this.showStatus('workStatus', 'error', '처리할 작업 데이터가 없습니다.');
            return;
        }

        try {
            this.showStatus('workStatus', 'info', '작업 데이터를 처리하고 있습니다...');
            
            // 중복/미일치 데이터 분석
            const analysis = this.analyzeWorkData(this.workData);
            
            // 분석 결과 표시
            this.showDataAnalysis(analysis, 'workStatus');
            
            // 데이터 중복 체크 및 처리
            const processedData = await this.processWorkDataLogic(this.workData);
            
            // 로컬 스토리지에 저장
            this.saveWorkDataToLocal(processedData);
            
            // Supabase에 동기화 (연결된 경우)
            if (this.supabase) {
                await this.syncWorkDataToSupabase(processedData);
            }
            
            // 처리 결과 요약 표시
            const summaryMessage = this.generateWorkDataSummary(processedData, analysis);
            this.showStatus('workStatus', 'success', summaryMessage);
            
            // 통계 업데이트
            this.updateStats();
            
            // 데이터 미리보기 새로고침
            this.showWorkPreview(this.workData);
            
        } catch (error) {
            console.error('작업 데이터 처리 오류:', error);
            this.showStatus('workStatus', 'error', `데이터 처리 중 오류가 발생했습니다: ${error.message}`);
            
            // 오류 상세 정보 표시
            this.showErrorDetails(error, 'workStatus');
        }
    }

    async processExpenseData() {
        if (!this.expenseData.length) {
            this.showStatus('expenseStatus', 'error', '처리할 경비 데이터가 없습니다.');
            return;
        }

        try {
            this.showStatus('expenseStatus', 'info', '경비 데이터를 처리하고 있습니다...');
            
            // 중복/미일치 데이터 분석
            const analysis = this.analyzeExpenseData(this.expenseData);
            
            // 분석 결과 표시
            this.showDataAnalysis(analysis, 'expenseStatus');
            
            // 데이터 중복 체크 및 처리
            const processedData = await this.processExpenseDataLogic(this.expenseData);
            
            // 로컬 스토리지에 저장
            this.saveExpenseDataToLocal(processedData);
            
            // Supabase에 동기화 (연결된 경우)
            if (this.supabase) {
                await this.syncExpenseDataToSupabase(processedData);
            }
            
            // 처리 결과 요약 표시
            const summaryMessage = this.generateExpenseDataSummary(processedData, analysis);
            this.showStatus('expenseStatus', 'success', summaryMessage);
            
            // 통계 업데이트
            this.updateStats();
            
            // 데이터 미리보기 새로고침
            this.showExpensePreview(this.expenseData);
            
        } catch (error) {
            console.error('경비 데이터 처리 오류:', error);
            this.showStatus('expenseStatus', 'error', `데이터 처리 중 오류가 발생했습니다: ${error.message}`);
            
            // 오류 상세 정보 표시
            this.showErrorDetails(error, 'expenseStatus');
        }
    }

    // 공통 데이터 처리 함수
    async processDataLogic(data, config) {
        const processed = [];
        const duplicates = [];
        const unmatched = [];
        const filteredBySite = [];
        
        for (const row of data) {
            const record = config.createRecord(row);

            // 현장명 필터링
            const site = this.findSite(record.site);
            if (!site) {
                filteredBySite.push({
                    row: data.indexOf(row) + 2,
                    site: record.site,
                    reason: '등록되지 않은 현장명'
                });
                continue;
            }

            // 중복 체크
            const existingRecord = config.findExistingRecord(record);
            if (existingRecord) {
                duplicates.push({ existing: existingRecord, new: record });
                continue;
            }

            // 엔티티 검증
            if (config.entityValidations) {
                let hasUnmatched = false;
                config.entityValidations.forEach(validation => {
                    if (!validation.validator(record[validation.field])) {
                        unmatched.push({ ...record, unmatchedField: validation.field });
                        hasUnmatched = true;
                    }
                });
                if (hasUnmatched) continue;
            }

            // 추가 처리 (급여 계산 등)
            if (config.postProcess) {
                config.postProcess(record);
            }

            processed.push(record);
        }

        console.log(`처리된 데이터: ${processed.length}건`);
        console.log(`중복 데이터: ${duplicates.length}건`);
        console.log(`미일치 데이터: ${unmatched.length}건`);
        console.log(`현장명 필터링된 데이터: ${filteredBySite.length}건`);

        return processed;
    }

    // 작업 데이터 처리
    async processWorkDataLogic(data) {
        return this.processDataLogic(data, {
            createRecord: (row) => ({
                date: this.parseDate(row['일자'] || row['사용일'] || row['년-월-일'] || row['날짜']),
                site: row['현장'],
                worker: row['작업자'],
                hours: parseFloat(row['공수']) || 0,
                memo: row['메모'] || '',
                timestamp: new Date().toISOString()
            }),
            findExistingRecord: (record) => this.findExistingWorkRecord(record),
            entityValidations: [
                { field: 'worker', validator: (name) => this.findWorker(name) }
            ],
            postProcess: (record) => {
                const worker = this.findWorker(record.worker);
                if (worker) {
                    record.totalSalary = this.calculateSalary(worker, record.hours);
                    record.tax = Math.round(record.totalSalary * (this.config.taxRate || 3.3) / 100);
                    record.netSalary = record.totalSalary - record.tax;
                }
            }
        });
    }

    // 경비 데이터 처리
    async processExpenseDataLogic(data) {
        return this.processDataLogic(data, {
            createRecord: (row) => ({
                date: this.parseDate(row['사용일'] || row['날짜']),
                site: row['현장'],
                worker: row['작업자'] || '',
                category: row['항목'],
                amount: parseFloat(row['금액']) || 0,
                location: row['사용처'] || '',
                address: row['주소'] || '',
                timestamp: new Date().toISOString()
            }),
            findExistingRecord: (record) => this.findExistingExpenseRecord(record),
            entityValidations: []
        });
    }

    // 작업자 급여 계산 로직 - 일당 × 공수
    calculateSalary(worker, hours) {
        if (!worker || !hours || hours <= 0) return 0;
        
        const daily = worker.daily || 0;
        
        // 일당 × 공수로 계산
        if (daily > 0) {
            return Math.round(daily * hours);
        }
        
        return 0;
    }

    // 데이터 분석 결과 표시
    showDataAnalysis(analysis, statusElementId) {
        const statusDiv = document.getElementById(statusElementId);
        const analysisDiv = document.createElement('div');
        analysisDiv.className = 'data-analysis';
        analysisDiv.innerHTML = `
            <div class="analysis-summary">
                <h5>📊 데이터 분석 결과</h5>
                <div class="summary-stats">
                    <span class="stat-item total">총 데이터: ${analysis.summary.total}건</span>
                    <span class="stat-item valid">유효: ${analysis.summary.valid}건</span>
                    <span class="stat-item duplicates">중복: ${analysis.summary.duplicates}건</span>
                    <span class="stat-item unmatched">미일치: ${analysis.summary.unmatched}건</span>
                    ${analysis.filteredBySite ? `<span class="stat-item filtered">미일치현장: ${analysis.filteredBySite.length}건</span>` : ''}
                </div>
            </div>
        `;

        // 중복 데이터 상세
        if (analysis.duplicates.total > 0) {
            analysisDiv.innerHTML += `
                <div class="duplicates-detail">
                    <h6>🔄 중복 데이터 상세 (${analysis.duplicates.total}건)</h6>
                    ${analysis.duplicates.exact.length > 0 ? `
                        <div class="exact-duplicates">
                            <strong>정확 중복: ${analysis.duplicates.exact.length}건</strong>
                            ${analysis.duplicates.exact.map(dup => `
                                <div class="duplicate-item">
                                    <span class="row-info">행 ${dup.row}</span>
                                    <span class="duplicate-info">→ 행 ${dup.duplicateOf}와 동일</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${analysis.duplicates.partial.length > 0 ? `
                        <div class="partial-duplicates">
                            <strong>부분 중복: ${analysis.duplicates.partial.length}건</strong>
                            ${analysis.duplicates.partial.map(dup => `
                                <div class="duplicate-item">
                                    <span class="row-info">행 ${dup.row}</span>
                                    <span class="duplicate-info">→ 행 ${dup.duplicateOf}와 ${dup.difference}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // 미일치 데이터 상세
        if (analysis.unmatched.total > 0) {
            analysisDiv.innerHTML += `
                <div class="unmatched-detail">
                    <h6>❌ 미일치 데이터 상세 (${analysis.unmatched.total}건)</h6>
                    ${analysis.unmatched.workers.length > 0 ? `
                        <div class="unmatched-workers">
                            <strong>등록되지 않은 작업자: ${analysis.unmatched.workers.length}건</strong>
                            ${analysis.unmatched.workers.map(unmatch => `
                                <div class="unmatched-item">
                                    <span class="row-info">행 ${unmatch.row}</span>
                                    <span class="unmatched-info">: "${unmatch.worker}"</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${analysis.unmatched.sites.length > 0 ? `
                        <div class="unmatched-sites">
                            <strong>등록되지 않은 현장: ${analysis.unmatched.sites.length}건</strong>
                            ${analysis.unmatched.sites.map(unmatch => `
                                <div class="unmatched-item">
                                    <span class="row-info">행 ${unmatch.row}</span>
                                    <span class="unmatched-info">: "${unmatch.site}"</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // 미일치 현장명 데이터 상세
        if (analysis.filteredBySite && analysis.filteredBySite.length > 0) {
            analysisDiv.innerHTML += `
                <div class="unmatched-site-detail">
                    <h6>🚫 미일치 현장명 데이터 상세 (${analysis.filteredBySite.length}건)</h6>
                    <div class="unmatched-sites">
                        <strong>관리자 설정에 등록되지 않은 현장명 - 미일치 데이터로 관리 필요</strong>
                        ${analysis.filteredBySite.map(filtered => `
                            <div class="unmatched-site-item">
                                <span class="row-info">행 ${filtered.row}</span>
                                <span class="unmatched-site-info">: "${filtered.site}" (${filtered.reason})</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // 분석 결과를 상태 메시지 아래에 추가
        statusDiv.appendChild(analysisDiv);
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        
        // 엑셀 날짜 숫자인 경우 (1900년 1월 1일부터의 일수)
        if (typeof dateStr === 'number') {
            try {
                // 1900년 1월 1일을 기준으로 날짜 계산
                const date = new Date(1900, 0, dateStr - 1);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0]; // YYYY-MM-DD 형식 반환
                }
            } catch (error) {
                console.warn('날짜 변환 실패:', dateStr, error);
            }
        }
        
        // 다양한 날짜 형식 처리
        let date;
        
        if (typeof dateStr === 'string') {
            // YYYY-MM-DD 형식
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                date = new Date(dateStr);
            }
            // YYYY/MM/DD 형식
            else if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
                date = new Date(dateStr);
            }
            // YYYYMMDD 형식
            else if (/^\d{8}$/.test(dateStr)) {
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                date = new Date(year, month - 1, day);
            }
            // MM/DD/YYYY 형식 (미국식)
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                date = new Date(dateStr);
            }
            // DD/MM/YYYY 형식 (유럽식)
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                const parts = dateStr.split('/');
                date = new Date(parts[2], parts[1] - 1, parts[0]);
            }
            // 일반적인 날짜 문자열
            else {
                date = new Date(dateStr);
            }
        }
        
        // Date 객체인 경우
        if (dateStr instanceof Date) {
            date = dateStr;
        }
        
        // 유효한 날짜인지 확인
        if (date && !isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]; // YYYY-MM-DD 형식 반환
        }
        
        console.warn('날짜 파싱 실패:', dateStr);
        return null;
    }

    findExistingWorkRecord(record) {
        const existingData = JSON.parse(localStorage.getItem('workData') || '[]');
        return existingData.find(existing => 
            existing.date === record.date &&
            existing.site === record.site &&
            existing.worker === record.worker
        );
    }

    findExistingExpenseRecord(record) {
        const existingData = JSON.parse(localStorage.getItem('expenseData') || '[]');
        
        // 중복 검사 키 생성 함수
        const createDuplicateKey = (item) => {
            return `${item.date || ''}|${item.site || ''}|${item.worker || ''}|${item.category || ''}|${item.amount || ''}|${item.vendor || ''}|${item.address || ''}`;
        };
        
        const recordKey = createDuplicateKey(record);
        
        return existingData.find(existing => {
            const existingKey = createDuplicateKey(existing);
            return existingKey === recordKey;
        });
    }

    findWorker(workerName) {
        // 먼저 로컬 스토리지에서 검색
        let worker = this.workers.find(worker => worker.name === workerName);
        
        // 로컬에 없으면 index.html의 db.workers에서 검색
        if (!worker && window.db && window.db.workers) {
            worker = window.db.workers.find(w => w.name === workerName);
            if (worker) {
                // index.html의 구조에 맞게 변환
                return {
                    name: worker.name,
                    daily: worker.daily,
                    monthlySalary: 0
                };
            }
        }
        
        return worker;
    }

    findSite(siteName) {
        return this.sites.find(site => site.name === siteName);
    }

    saveWorkDataToLocal(data) {
        const existingData = JSON.parse(localStorage.getItem('workData') || '[]');
        const newData = [...existingData, ...data];
        localStorage.setItem('workData', JSON.stringify(newData));
    }

    saveExpenseDataToLocal(data) {
        const existingData = JSON.parse(localStorage.getItem('expenseData') || '[]');
        const newData = [...existingData, ...data];
        localStorage.setItem('expenseData', JSON.stringify(newData));
    }

    async syncWorkDataToSupabase(data) {
        if (!this.supabase) return;
        
        try {
            const { data: result, error } = await this.supabase
                .from('work_records')
                .upsert(data, { onConflict: 'date,site,worker' });
                
            if (error) throw error;
            console.log('작업 데이터 Supabase 동기화 완료:', result);
        } catch (error) {
            console.error('Supabase 동기화 오류:', error);
            throw error;
        }
    }

    async syncExpenseDataToSupabase(data) {
        if (!this.supabase) return;
        
        try {
            const { data: result, error } = await this.supabase
                .from('expense_records')
                .upsert(data, { onConflict: 'date,site,category,amount' });
                
            if (error) throw error;
            console.log('경비 데이터 Supabase 동기화 완료:', result);
        } catch (error) {
            console.error('Supabase 동기화 오류:', error);
            throw error;
        }
    }

    clearWorkData() {
        this.workData = [];
        document.getElementById('workPreview').style.display = 'none';
        document.getElementById('workStatus').innerHTML = '';
        document.getElementById('workFileInput').value = '';
    }

    clearExpenseData() {
        this.expenseData = [];
        document.getElementById('expensePreview').style.display = 'none';
        document.getElementById('expenseStatus').innerHTML = '';
        document.getElementById('expenseFileInput').value = '';
    }

    // 작업자 관리
    addWorker() {
        const name = document.getElementById('workerName').value.trim();
        const daily = parseFloat(document.getElementById('workerDaily').value);
        
        if (!name) {
            alert('작업자명을 입력해주세요.');
            return;
        }
        
        const worker = {
            id: Date.now(),
            name,
            daily: daily || 0,
            monthlySalary: 0,
            timestamp: new Date().toISOString()
        };
        
        this.workers.push(worker);
        this.saveWorkers();
        this.loadWorkers();
        this.updateStats();
        
        // 입력 필드 초기화
        document.getElementById('workerName').value = '';
        document.getElementById('workerDaily').value = '';
    }

    removeWorker(id) {
        if (confirm('정말로 이 작업자를 삭제하시겠습니까?')) {
            this.workers = this.workers.filter(worker => worker.id !== id);
            this.saveWorkers();
            this.loadWorkers();
            this.updateStats();
        }
    }

    // 현장 관리
    addSite() {
        const name = document.getElementById('siteName').value.trim();
        const address = document.getElementById('siteAddress').value.trim();
        const manager = document.getElementById('siteManager').value.trim();
        
        if (!name) {
            alert('현장명을 입력해주세요.');
            return;
        }
        
        const site = {
            id: Date.now(),
            name,
            address: address || '',
            manager: manager || '',
            timestamp: new Date().toISOString()
        };
        
        this.sites.push(site);
        this.saveSites();
        this.loadSites();
        this.updateStats();
        
        // 입력 필드 초기화
        document.getElementById('siteName').value = '';
        document.getElementById('siteAddress').value = '';
        document.getElementById('siteManager').value = '';
    }

    removeSite(id) {
        if (confirm('정말로 이 현장을 삭제하시겠습니까?')) {
            this.sites = this.sites.filter(site => site.id !== id);
            this.saveSites();
            this.loadSites();
            this.updateStats();
        }
    }

    // 설정 관리
    saveSystemConfig() {
        const config = {
            supabaseUrl: document.getElementById('supabaseUrl').value,
            supabaseKey: document.getElementById('supabaseKey').value,
            taxRate: parseFloat(document.getElementById('taxRate').value) || 3.3
        };
        
        localStorage.setItem('adminConfig', JSON.stringify(config));
        this.config = config;
        
        alert('설정이 저장되었습니다.');
        
        // Supabase 재초기화
        if (config.supabaseUrl && config.supabaseKey) {
            this.initSupabase();
        }
    }

    loadConfig() {
        const savedConfig = localStorage.getItem('adminConfig');
        if (savedConfig) {
            this.config = JSON.parse(savedConfig);
            document.getElementById('supabaseUrl').value = this.config.supabaseUrl || '';
            document.getElementById('supabaseKey').value = this.config.supabaseKey || '';
            document.getElementById('taxRate').value = this.config.taxRate || 3.3;
        }
    }

    async initSupabase() {
        if (!this.config.supabaseUrl || !this.config.supabaseKey) {
            return;
        }
        
        try {
            this.supabase = window.supabase.createClient(
                this.config.supabaseUrl,
                this.config.supabaseKey
            );
            console.log('Supabase 연결 성공');
        } catch (error) {
            console.error('Supabase 연결 실패:', error);
        }
    }

    async testConnection() {
        if (!this.supabase) {
            alert('Supabase 설정을 먼저 완료해주세요.');
            return;
        }
        
        try {
            const { data, error } = await this.supabase.from('work_records').select('count').limit(1);
            if (error) throw error;
            alert('Supabase 연결이 정상입니다!');
        } catch (error) {
            alert(`Supabase 연결 테스트 실패: ${error.message}`);
        }
    }

    // 데이터 동기화
    async syncToSupabase() {
        if (!this.supabase) {
            alert('Supabase 설정을 먼저 완료해주세요.');
            return;
        }
        
        try {
            this.showStatus('syncStatus', 'info', '데이터 동기화를 시작합니다...');
            
            // 작업 데이터 동기화
            const workData = JSON.parse(localStorage.getItem('workData') || '[]');
            if (workData.length > 0) {
                await this.syncWorkDataToSupabase(workData);
            }
            
            // 경비 데이터 동기화
            const expenseData = JSON.parse(localStorage.getItem('expenseData') || '[]');
            if (expenseData.length > 0) {
                await this.syncExpenseDataToSupabase(expenseData);
            }
            
            this.showStatus('syncStatus', 'success', '모든 데이터가 성공적으로 동기화되었습니다.');
        } catch (error) {
            this.showStatus('syncStatus', 'error', `동기화 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    exportAllData() {
        const workData = JSON.parse(localStorage.getItem('workData') || '[]');
        const expenseData = JSON.parse(localStorage.getItem('expenseData') || '[]');
        const workers = this.workers;
        const sites = this.sites;
        
        const exportData = {
            workRecords: workData,
            expenseRecords: expenseData,
            workers: workers,
            sites: sites,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admin_console_data_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showDataStatus() {
        const modal = document.getElementById('dataStatusModal');
        const content = document.getElementById('dataStatusContent');
        
        const workData = JSON.parse(localStorage.getItem('workData') || '[]');
        const expenseData = JSON.parse(localStorage.getItem('expenseData') || '[]');
        
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4>작업 데이터 현황</h4>
                <p>총 ${workData.length}건</p>
                <p>최근 업데이트: ${workData.length > 0 ? new Date(workData[workData.length - 1].timestamp).toLocaleString() : '없음'}</p>
            </div>
            <div style="margin-bottom: 20px;">
                <h4>경비 데이터 현황</h4>
                <p>총 ${expenseData.length}건</p>
                <p>최근 업데이트: ${expenseData.length > 0 ? new Date(expenseData[expenseData.length - 1].timestamp).toLocaleString() : '없음'}</p>
            </div>
            <div style="margin-bottom: 20px;">
                <h4>작업자 현황</h4>
                <p>총 ${this.workers.length}명</p>
            </div>
            <div>
                <h4>현장 현황</h4>
                <p>총 ${this.sites.length}개</p>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    // 유틸리티 함수들
    saveWorkers() {
        localStorage.setItem('workers', JSON.stringify(this.workers));
    }

    loadWorkers() {
        const saved = localStorage.getItem('workers');
        if (saved) {
            this.workers = JSON.parse(saved);
        }
        this.renderWorkers();
    }

    renderWorkers() {
        const container = document.getElementById('workerList');
        if (!container) return; // admin-console.html에만 존재하는 요소
        
        container.innerHTML = '';
        
        this.workers.forEach(worker => {
            const div = document.createElement('div');
            div.className = 'worker-item';
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid var(--b); border-radius: 6px; margin-bottom: 8px; background: var(--input-bg);';
            div.innerHTML = `
                <div class="worker-info">
                    <div style="font-weight: 600; margin-bottom: 4px;">${worker.name}</div>
                    <div style="font-size: var(--fz-caption); color: var(--g);">
                        일당: ${worker.daily ? worker.daily.toLocaleString() + '원' : '설정안됨'}
                    </div>
                </div>
                <div class="worker-actions">
                    <button class="btn btn-danger btn-sm" onclick="adminConsole.removeWorker(${worker.id})" style="padding: 4px 8px; font-size: var(--fz-caption);">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    saveSites() {
        localStorage.setItem('sites', JSON.stringify(this.sites));
    }

    loadSites() {
        const saved = localStorage.getItem('sites');
        if (saved) {
            this.sites = JSON.parse(saved);
        }
        this.renderSites();
    }

    renderSites() {
        const container = document.getElementById('siteList');
        container.innerHTML = '';
        
        this.sites.forEach(site => {
            const div = document.createElement('div');
            div.className = 'worker-item';
            div.innerHTML = `
                <div class="worker-info">
                    <div class="worker-name">${site.name}</div>
                    <div class="worker-salary">
                        주소: ${site.address || '설정안됨'} | 
                        담당자: ${site.manager || '설정안됨'}
                    </div>
                </div>
                <div class="worker-actions">
                    <button class="btn btn-danger btn-sm" onclick="adminConsole.removeSite(${site.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    loadStats() {
        const workData = JSON.parse(localStorage.getItem('workData') || '[]');
        const expenseData = JSON.parse(localStorage.getItem('expenseData') || '[]');
        
        document.getElementById('totalWorkRecords').textContent = workData.length;
        document.getElementById('totalExpenses').textContent = expenseData.length;
    }

    updateStats() {
        this.loadStats();
        document.getElementById('totalWorkers').textContent = this.workers.length;
        document.getElementById('totalSites').textContent = this.sites.length;
    }

    showValidationErrors(validationResult, statusElementId) {
        const errorsDiv = document.getElementById(statusElementId);
        errorsDiv.innerHTML = '';

        // 검증 결과 요약
        const summary = validationResult.summary;
        errorsDiv.innerHTML += `
            <div class="validation-summary">
                <h5>📊 검증 결과 요약</h5>
                <div class="summary-stats">
                    <span class="stat-item total">총 데이터: ${summary.total}건</span>
                    <span class="stat-item valid">유효: ${summary.valid}건</span>
                    <span class="stat-item errors">오류: ${summary.errors}건</span>
                    <span class="stat-item warnings">경고: ${summary.warnings}건</span>
                </div>
            </div>
        `;

        if (validationResult.errors.length > 0) {
            errorsDiv.innerHTML += `
                <div class="validation-errors">
                    <h5>❌ 오류 (${validationResult.errors.length}건)</h5>
                    <div class="error-list">
                        ${validationResult.errors.map(error => `<p class="error-item">${error}</p>`).join('')}
                    </div>
                </div>
            `;
        }

        if (validationResult.warnings.length > 0) {
            errorsDiv.innerHTML += `
                <div class="validation-warnings">
                    <h5>⚠️ 경고 (${validationResult.warnings.length}건)</h5>
                    <div class="warning-list">
                        ${validationResult.warnings.map(warning => `<p class="warning-item">${warning}</p>`).join('')}
                    </div>
                </div>
            `;
        }

        if (validationResult.errors.length === 0 && validationResult.warnings.length === 0) {
            errorsDiv.innerHTML += '<p class="success-message">✅ 모든 데이터가 유효합니다.</p>';
        }
    }

    // 공통 데이터 분석 함수
    analyzeData(data, config) {
        const analysis = {
            duplicates: {
                exact: [],
                partial: [],
                total: 0
            },
            unmatched: {
                workers: [],
                sites: [],
                total: 0
            },
            filteredBySite: [],
            summary: {
                total: data.length,
                valid: 0,
                duplicates: 0,
                unmatched: 0
            }
        };

        // 중복 데이터 분석
        const seen = new Map();
        data.forEach((row, index) => {
            const date = this.parseDate(config.getDateValue(row));
            const key = config.getDuplicateKey(row, date);
            
            if (seen.has(key)) {
                const existing = seen.get(key);
                if (config.isExactDuplicate(row, existing.data)) {
                    analysis.duplicates.exact.push({
                        row: index + 2,
                        data: row,
                        duplicateOf: existing.row
                    });
                } else {
                    analysis.duplicates.partial.push({
                        row: index + 2,
                        data: row,
                        duplicateOf: existing.row,
                        difference: config.getDifferenceDescription(row, existing.data)
                    });
                }
                analysis.duplicates.total++;
            } else {
                seen.set(key, { data: row, row: index + 2 });
            }

            // 미일치 데이터 분석
            if (config.entityValidations) {
                config.entityValidations.forEach(validation => {
                    if (row[validation.field] && !validation.validator(row[validation.field])) {
                        if (validation.type === 'worker') {
                            analysis.unmatched.workers.push({
                                row: index + 2,
                                worker: row[validation.field]
                            });
                        } else if (validation.type === 'site') {
                            analysis.unmatched.sites.push({
                                row: index + 2,
                                site: row[validation.field]
                            });
                        }
                    }
                });
            }
        });

        analysis.unmatched.total = analysis.unmatched.workers.length + analysis.unmatched.sites.length;
        analysis.summary.duplicates = analysis.duplicates.total;
        analysis.summary.unmatched = analysis.unmatched.total;
        analysis.summary.valid = data.length - analysis.duplicates.total;

        // 현장명 필터링 데이터 수집 (미일치 현장명)
        const filteredSites = new Set();
        data.forEach(row => {
            const site = row['현장'];
            if (site && !this.findSite(site)) {
                filteredSites.add(site);
            }
        });
        analysis.filteredBySite = Array.from(filteredSites).map(site => ({
            row: data.findIndex(row => row['현장'] === site) + 2,
            site: site,
            reason: '등록되지 않은 현장명 - 미일치 데이터로 관리 필요'
        }));

        return analysis;
    }

    // 작업 데이터 분석
    analyzeWorkData(data) {
        return this.analyzeData(data, {
            getDateValue: (row) => row['일자'] || row['사용일'] || row['년-월-일'] || row['날짜'],
            getDuplicateKey: (row, date) => `${date}_${row['현장']}_${row['작업자']}`,
            isExactDuplicate: (row, existing) => row['공수'] === existing['공수'],
            getDifferenceDescription: (row, existing) => `공수: ${existing['공수']} vs ${row['공수']}`,
            entityValidations: [
                { field: '작업자', type: 'worker', validator: (name) => this.findWorker(name) },
                { field: '현장', type: 'site', validator: (name) => this.findSite(name) }
            ]
        });
    }

    // 경비 데이터 분석
    analyzeExpenseData(data) {
        return this.analyzeData(data, {
            getDateValue: (row) => row['사용일'] || row['날짜'],
            getDuplicateKey: (row, date) => `${date}_${row['현장']}_${row['작업자']}_${row['항목']}_${row['금액']}_${row['사용처']}_${row['주소']}`,
            isExactDuplicate: (row, existing) => 
                row['현장'] === existing['현장'] &&
                row['사용일'] === existing['사용일'] &&
                row['작업자'] === existing['작업자'] &&
                row['항목'] === existing['항목'] &&
                row['금액'] === existing['금액'] &&
                row['사용처'] === existing['사용처'] &&
                row['주소'] === existing['주소'],
            getDifferenceDescription: (row, existing) => '현장, 사용일, 작업자, 항목, 금액, 사용처, 주소 중 하나라도 다른 데이터',
            entityValidations: [
                { field: '현장', type: 'site', validator: (name) => this.findSite(name) }
            ]
        });
    }

    // 공통 요약 생성 함수
    generateDataSummary(processedData, analysis, dataType, config) {
        let summaryMessage = `${dataType} ${processedData.length}건을 처리했습니다. `;
        
        if (analysis.summary.duplicates > 0) {
            summaryMessage += `${analysis.summary.duplicates}건의 중복 데이터가 발견되었습니다. `;
            if (analysis.duplicates.exact.length > 0) {
                summaryMessage += `${analysis.duplicates.exact.length}건은 정확히 동일한 데이터로 간주되었습니다. `;
            }
            if (analysis.duplicates.partial.length > 0) {
                summaryMessage += `${analysis.duplicates.partial.length}건은 ${config.partialDuplicateDescription} `;
            }
        }

        if (analysis.summary.unmatched > 0) {
            summaryMessage += `${analysis.summary.unmatched}건의 미일치 데이터가 발견되었습니다. `;
            if (analysis.unmatched.workers.length > 0) {
                summaryMessage += `${analysis.unmatched.workers.length}건은 등록되지 않은 작업자가 포함된 데이터입니다. `;
            }
            if (analysis.unmatched.sites.length > 0) {
                summaryMessage += `${analysis.unmatched.sites.length}건은 등록되지 않은 현장이 포함된 데이터입니다. `;
            }
        }

        if (analysis.filteredBySite && analysis.filteredBySite.length > 0) {
            summaryMessage += `${analysis.filteredBySite.length}건의 미일치 현장명이 발견되었습니다. 이 데이터는 별도로 관리되어야 합니다. `;
        }

        summaryMessage += `유효한 데이터는 ${analysis.summary.valid}건입니다.`;
        return summaryMessage;
    }

    // 작업 데이터 요약
    generateWorkDataSummary(processedData, analysis) {
        return this.generateDataSummary(processedData, analysis, '작업 데이터', {
            partialDuplicateDescription: '날짜, 현장, 작업자는 동일하지만 공수가 다른 데이터로 간주되었습니다.'
        });
    }

    // 경비 데이터 요약
    generateExpenseDataSummary(processedData, analysis) {
        return this.generateDataSummary(processedData, analysis, '경비 데이터', {
            partialDuplicateDescription: '현장, 사용일, 작업자, 항목, 금액, 사용처, 주소 중 하나라도 다른 데이터로 간주되었습니다.'
        });
    }

    showErrorDetails(error, statusElementId) {
        const errorsDiv = document.getElementById(statusElementId);
        errorsDiv.innerHTML = '';

        errorsDiv.innerHTML += `
            <div class="error-details">
                <h5>❌ 오류 상세 정보</h5>
                <p>오류 메시지: ${error.message}</p>
                <p>오류 발생 위치: ${error.stack}</p>
            </div>
        `;
    }

    // 공통 데이터 정리 함수
    cleanData(data, config, statusElementId, dataType) {
        if (!data.length) {
            this.showStatus(statusElementId, 'warning', `정리할 ${dataType}가 없습니다.`);
            return;
        }

        try {
            this.showStatus(statusElementId, 'info', `${dataType}를 정리하고 있습니다...`);
            
            // 데이터 분석
            const analysis = config.analyzer(data);
            
            // 문제가 있는 데이터 필터링
            const cleanedData = data.filter((row, index) => {
                // 필수 필드 검증
                const hasRequiredFields = config.requiredFields.every(field => row[field] && row[field] !== 0);
                if (!hasRequiredFields) return false;
                
                // 숫자 필드 검증
                if (config.numericFields) {
                    const hasValidNumbers = config.numericFields.every(field => {
                        const value = parseFloat(row[field]);
                        return !isNaN(value) && value > 0;
                    });
                    if (!hasValidNumbers) return false;
                }
                
                // 엔티티 존재 여부 검증
                if (config.entityValidations) {
                    const hasValidEntities = config.entityValidations.every(validation => 
                        validation.validator(row[validation.field])
                    );
                    if (!hasValidEntities) return false;
                }
                
                return true;
            });
            
            // 정리된 데이터로 교체
            if (dataType === '작업 데이터') {
                this.workData = cleanedData;
                this.showWorkPreview(this.workData);
            } else {
                this.expenseData = cleanedData;
                this.showExpensePreview(this.expenseData);
            }
            
            const removedCount = analysis.summary.total - cleanedData.length;
            this.showStatus(statusElementId, 'success', 
                `데이터 정리 완료: ${removedCount}건의 문제 데이터가 제거되었습니다. 유효한 데이터: ${cleanedData.length}건`);
            
        } catch (error) {
            console.error(`${dataType} 정리 오류:`, error);
            this.showStatus(statusElementId, 'error', `데이터 정리 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    // 작업 데이터 정리
    cleanWorkData() {
        this.cleanData(this.workData, {
            analyzer: (data) => this.analyzeWorkData(data),
            requiredFields: ['작업자', '일자', '현장', '공수'],
            numericFields: ['공수'],
            entityValidations: [
                { field: '작업자', validator: (name) => this.findWorker(name) },
                { field: '현장', validator: (name) => this.findSite(name) }
            ]
        }, 'workStatus', '작업 데이터');
    }

    // 경비 데이터 정리
    cleanExpenseData() {
        this.cleanData(this.expenseData, {
            analyzer: (data) => this.analyzeExpenseData(data),
            requiredFields: ['현장', '사용일', '항목', '금액'],
            numericFields: ['금액'],
            entityValidations: [
                { field: '현장', validator: (name) => this.findSite(name) }
            ]
        }, 'expenseStatus', '경비 데이터');
    }

    // 공통 문제점 보기 함수
    showDataIssuesGeneric(data, statusElementId, dataType, analyzer) {
        if (!data.length) {
            this.showStatus(statusElementId, 'warning', `검사할 ${dataType}가 없습니다.`);
            return;
        }

        try {
            const analysis = analyzer(data);
            this.showDataIssues(analysis, statusElementId, dataType);
        } catch (error) {
            console.error(`${dataType} 문제점 분석 오류:`, error);
            this.showStatus(statusElementId, 'error', `문제점 분석 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    // 작업 데이터 문제점 보기
    showWorkDataIssues() {
        this.showDataIssuesGeneric(this.workData, 'workStatus', '작업 데이터', (data) => this.analyzeWorkData(data));
    }

    // 경비 데이터 문제점 보기
    showExpenseDataIssues() {
        this.showDataIssuesGeneric(this.expenseData, 'expenseStatus', '경비 데이터', (data) => this.analyzeExpenseData(data));
    }

    showDataIssues(analysis, statusElementId, dataType) {
        const statusDiv = document.getElementById(statusElementId);
        const issuesDiv = document.createElement('div');
        issuesDiv.className = 'data-issues';
        issuesDiv.innerHTML = `
            <div class="issues-summary">
                <h5>🔍 ${dataType} 문제점 분석</h5>
                <div class="summary-stats">
                    <span class="stat-item total">총 데이터: ${analysis.summary.total}건</span>
                    <span class="stat-item valid">유효: ${analysis.summary.valid}건</span>
                    <span class="stat-item duplicates">중복: ${analysis.summary.duplicates}건</span>
                    <span class="stat-item unmatched">미일치: ${analysis.summary.unmatched}건</span>
                    ${analysis.filteredBySite ? `<span class="stat-item filtered">미일치현장: ${analysis.filteredBySite.length}건</span>` : ''}
                </div>
            </div>
        `;

        // 문제가 있는 데이터 상세 표시
        if (analysis.summary.duplicates > 0 || analysis.summary.unmatched > 0 || (analysis.filteredBySite && analysis.filteredBySite.length > 0)) {
            issuesDiv.innerHTML += `
                <div class="issues-actions">
                    <button class="btn btn-warning" onclick="adminConsole.clean${dataType === '작업 데이터' ? 'Work' : 'Expense'}Data()">
                        <i class="fas fa-broom"></i> 문제 데이터 정리
                    </button>
                    <button class="btn btn-info" onclick="adminConsole.export${dataType === '작업 데이터' ? 'Work' : 'Expense'}Issues()">
                        <i class="fas fa-download"></i> 문제 데이터 내보내기
                    </button>
                </div>
            `;
        }

        // 분석 결과를 상태 메시지 아래에 추가
        statusDiv.appendChild(issuesDiv);
    }

    // 공통 중복 제거 함수
    removeDuplicates(data, keyFields) {
        const uniqueData = [];
        const seen = new Set();
        
        data.forEach(row => {
            const key = keyFields.map(field => row[field] || '').join('|');
            if (!seen.has(key)) {
                seen.add(key);
                uniqueData.push(row);
            }
        });
        
        return uniqueData;
    }

    // 메모이제이션을 위한 캐시
    memoize(func, keyGenerator) {
        const cache = new Map();
        
        return function(...args) {
            const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
            
            if (cache.has(key)) {
                return cache.get(key);
            }
            
            const result = func.apply(this, args);
            cache.set(key, result);
            return result;
        };
    }

    // 작업자 검색 최적화 (메모이제이션 적용)
    findWorkerOptimized = this.memoize(this.findWorker, (name) => name);

    // 공통 문제점 내보내기 함수
    exportIssuesGeneric(data, dataType, analyzer) {
        if (!data.length) return;
        
        const analysis = analyzer(data);
        this.exportIssuesData(analysis, data, `${dataType}_문제점`);
    }

    // 작업 데이터 문제점 내보내기
    exportWorkIssues() {
        this.exportIssuesGeneric(this.workData, '작업데이터', (data) => this.analyzeWorkData(data));
    }

    // 경비 데이터 문제점 내보내기
    exportExpenseIssues() {
        this.exportIssuesGeneric(this.expenseData, '경비데이터', (data) => this.analyzeExpenseData(data));
    }

    exportIssuesData(analysis, originalData, filename) {
        const issuesData = {
            summary: analysis.summary,
            duplicates: analysis.duplicates,
            unmatched: analysis.unmatched,
            filteredBySite: analysis.filteredBySite,
            originalData: originalData,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(issuesData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }



    

    
    // 셀 편집 관련 메서드들
    makeCellEditable(cell) {
        const currentValue = cell.textContent;
        const field = cell.dataset.field;
        const index = parseInt(cell.dataset.index);
        
        // 입력 필드 생성
        const input = document.createElement('input');
        input.type = this.getInputType(field);
        input.value = currentValue;
        input.className = 'cell-edit-input';
        
        // 입력 필드 스타일 적용
        input.style.width = '100%';
        input.style.padding = '4px';
        input.style.border = '1px solid #007bff';
        input.style.borderRadius = '4px';
        input.style.fontSize = '14px';
        
        // 기존 내용을 입력 필드로 교체
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        
        // 편집 완료 처리
        const finishEdit = () => {
            const newValue = input.value.trim();
            
            // 값이 변경된 경우에만 업데이트
            if (newValue !== currentValue) {
                // 데이터 업데이트
                if (field === '일자' || field === '사용일') {
                    // 날짜 형식 검증
                    if (this.isValidDate(newValue)) {
                        this.updateData(field, index, newValue);
                        cell.textContent = this.formatExcelDate(newValue);
                    } else {
                        alert('올바른 날짜 형식을 입력해주세요 (YYYY-MM-DD)');
                        cell.textContent = currentValue;
                    }
                } else if (field === '공수' || field === '금액') {
                    // 숫자 형식 검증
                    const numValue = parseFloat(newValue);
                    if (!isNaN(numValue) && numValue >= 0) {
                        this.updateData(field, index, numValue);
                        cell.textContent = field === '금액' ? this.formatCurrency(numValue) : numValue;
                    } else {
                        alert('올바른 숫자를 입력해주세요');
                        cell.textContent = currentValue;
                    }
                } else {
                    // 일반 텍스트
                    this.updateData(field, index, newValue);
                    cell.textContent = newValue;
                }
                
                // 급여 재계산 (작업 데이터인 경우)
                if (this.workData[index]) {
                    this.recalculateSalary(index);
                }
            } else {
                cell.textContent = currentValue;
            }
        };
        
        // Enter 키 또는 포커스 아웃 시 편집 완료
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                cell.textContent = currentValue;
            }
        });
        
        input.addEventListener('blur', finishEdit);
    }
    
    getInputType(field) {
        if (field === '일자' || field === '사용일') return 'date';
        if (field === '공수' || field === '금액') return 'number';
        return 'text';
    }
    
    isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }
    
    updateData(field, index, value) {
        // 작업 데이터 업데이트
        if (this.workData[index]) {
            this.workData[index][field] = value;
            console.log(`작업 데이터 업데이트: ${field} = ${value}`);
        }
        
        // 경비 데이터 업데이트
        if (this.expenseData[index]) {
            this.expenseData[index][field] = value;
            console.log(`경비 데이터 업데이트: ${field} = ${value}`);
        }
    }
    
    recalculateSalary(index) {
        const workRow = this.workData[index];
        if (!workRow) return;
        
        const worker = this.findWorker(workRow['작업자']);
        const hours = parseFloat(workRow['공수']) || 0;
        
        if (worker && hours > 0) {
            const totalSalary = this.calculateSalary(worker, hours);
            const tax = Math.round(totalSalary * (this.config.taxRate || 3.3) / 100);
            const netSalary = totalSalary - tax;
            
            // 테이블의 급여 컬럼들 업데이트
            const row = document.querySelector(`#workPreviewTable tbody tr:nth-child(${index + 1})`);
            if (row) {
                const cells = row.cells;
                if (cells[4]) cells[4].textContent = totalSalary > 0 ? totalSalary.toLocaleString() + '원' : '';
                if (cells[5]) cells[5].textContent = tax > 0 ? tax.toLocaleString() + '원' : '';
                if (cells[6]) cells[6].textContent = netSalary > 0 ? netSalary.toLocaleString() + '원' : '';
            }
        }
    }

    // PWA 관련 메서드들
    setupPWA() {
        // PWA 설치 가능 여부 확인
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker 등록 성공:', registration);
                })
                .catch(error => {
                    console.log('ServiceWorker 등록 실패:', error);
                });
        }
    }

    setupPWAEvents() {
        const installBtn = document.getElementById('adminPwaInstall');
        const installedBtn = document.getElementById('adminPwaInstalled');

        // PWA 설치 프롬프트 이벤트
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // 설치 버튼 표시
            if (installBtn) {
                installBtn.style.display = 'inline-flex';
                installBtn.addEventListener('click', () => this.installPWA());
            }
        });

        // PWA 설치 완료 이벤트
        window.addEventListener('appinstalled', () => {
            console.log('PWA 설치 완료');
            if (installBtn) installBtn.style.display = 'none';
            if (installedBtn) installedBtn.style.display = 'inline-flex';
            
            // 프롬프트 초기화
            this.deferredPrompt = null;
        });

        // 이미 설치된 경우 확인
        if (window.matchMedia('(display-mode: standalone)').matches) {
            if (installBtn) installBtn.style.display = 'none';
            if (installedBtn) installedBtn.style.display = 'inline-flex';
        }
    }

    async installPWA() {
        if (!this.deferredPrompt) return;

        // 설치 프롬프트 표시
        this.deferredPrompt.prompt();
        
        // 사용자 응답 대기
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('PWA 설치 결과:', outcome);
        
        // 프롬프트 초기화
        this.deferredPrompt = null;
    }
}

// 탭 전환 함수
function showTab(tabName) {
    // 모든 탭과 콘텐츠 비활성화
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭과 콘텐츠 활성화
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// 전역 함수들
function processWorkData() {
    if (window.adminConsole) {
        window.adminConsole.processWorkData();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function processExpenseData() {
    if (window.adminConsole) {
        window.adminConsole.processExpenseData();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function cleanWorkData() {
    if (window.adminConsole) {
        window.adminConsole.cleanWorkData();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function cleanExpenseData() {
    if (window.adminConsole) {
        window.adminConsole.cleanExpenseData();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function showWorkDataIssues() {
    if (window.adminConsole) {
        window.adminConsole.showWorkDataIssues();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function showExpenseDataIssues() {
    if (window.adminConsole) {
        window.adminConsole.showExpenseDataIssues();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function clearWorkData() {
    if (window.adminConsole) {
        window.adminConsole.clearWorkData();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function clearExpenseData() {
    if (window.adminConsole) {
        window.adminConsole.clearExpenseData();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function addWorker() {
    if (window.adminConsole) {
        window.adminConsole.addWorker();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function addSite() {
    if (window.adminConsole) {
        window.adminConsole.addSite();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function saveSystemConfig() {
    if (window.adminConsole) {
        window.adminConsole.saveSystemConfig();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function testConnection() {
    if (window.adminConsole) {
        window.adminConsole.testConnection();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function syncToSupabase() {
    if (window.adminConsole) {
        window.adminConsole.syncToSupabase();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function exportAllData() {
    if (window.adminConsole) {
        window.adminConsole.exportAllData();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function showDataStatus() {
    if (window.adminConsole) {
        window.adminConsole.showDataStatus();
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}

function closeModal(modalId) {
    if (window.adminConsole) {
        window.adminConsole.closeModal(modalId);
    } else {
        console.error('adminConsole이 아직 초기화되지 않았습니다.');
        alert('시스템이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
}



// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('AdminConsole 초기화 시작...');
        window.adminConsole = new AdminConsole();
        console.log('AdminConsole 인스턴스 생성 완료:', window.adminConsole);
        
        // 전역 함수들이 제대로 작동하는지 확인
        if (typeof window.processWorkData === 'undefined') {
            console.error('processWorkData 함수가 정의되지 않았습니다.');
        }
        if (typeof window.processExpenseData === 'undefined') {
            console.error('processExpenseData 함수가 정의되지 않았습니다.');
        }
    } catch (error) {
        console.error('AdminConsole 초기화 중 오류 발생:', error);
    }
});

// 전역 함수들이 제대로 작동하는지 확인하는 함수 추가
window.addEventListener('load', () => {
    console.log('페이지 로드 완료');
    console.log('adminConsole 객체:', window.adminConsole);
    console.log('processWorkData 함수:', typeof window.processWorkData);
    console.log('processExpenseData 함수:', typeof window.processExpenseData);
});

// 모달 외부 클릭 시 닫기
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}
