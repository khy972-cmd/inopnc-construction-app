-- Supabase 데이터베이스 스키마
-- 작업관리 시스템을 위한 테이블 구조

-- 작업자 테이블
CREATE TABLE IF NOT EXISTS workers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    monthly_salary DECIMAL(12,2) DEFAULT 0,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 현장 테이블
CREATE TABLE IF NOT EXISTS sites (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    manager VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 작업 기록 테이블
CREATE TABLE IF NOT EXISTS work_records (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    site VARCHAR(200) NOT NULL,
    worker VARCHAR(100) NOT NULL,
    hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    memo TEXT,
    total_salary DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    net_salary DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 중복 방지를 위한 유니크 제약
    UNIQUE(date, site, worker)
);

-- 경비 기록 테이블
CREATE TABLE IF NOT EXISTS expense_records (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    site VARCHAR(200) NOT NULL,
    worker VARCHAR(100),
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    location VARCHAR(200),
    address TEXT,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 중복 방지를 위한 유니크 제약
    UNIQUE(date, site, category, amount)
);

-- 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS system_config (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 설정 데이터 삽입
INSERT INTO system_config (key, value, description) VALUES
('tax_rate', '3.3', '기본 세율 (%)'),
('default_hourly_rate', '15000', '기본 시간당 단가'),
('default_monthly_hours', '160', '기본 월 근무 시간')
ON CONFLICT (key) DO NOTHING;

-- 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_work_records_date ON work_records(date);
CREATE INDEX IF NOT EXISTS idx_work_records_worker ON work_records(worker);
CREATE INDEX IF NOT EXISTS idx_work_records_site ON work_records(site);
CREATE INDEX IF NOT EXISTS idx_work_records_date_worker ON work_records(date, worker);

CREATE INDEX IF NOT EXISTS idx_expense_records_date ON expense_records(date);
CREATE INDEX IF NOT EXISTS idx_expense_records_site ON expense_records(site);
CREATE INDEX IF NOT EXISTS idx_expense_records_category ON expense_records(category);

CREATE INDEX IF NOT EXISTS idx_workers_name ON workers(name);
CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name);

-- RLS (Row Level Security) 활성화
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 기본 정책 (모든 사용자가 읽기/쓰기 가능)
CREATE POLICY "Enable read access for all users" ON workers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON workers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON workers FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON workers FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON sites FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON sites FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON sites FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON sites FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON work_records FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON work_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON work_records FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON work_records FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON expense_records FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON expense_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON expense_records FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON expense_records FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON system_config FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON system_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON system_config FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON system_config FOR DELETE USING (true);

-- 뷰 생성 (데이터 분석용)
CREATE OR REPLACE VIEW work_summary AS
SELECT 
    wr.date,
    wr.site,
    wr.worker,
    wr.hours,
    wr.total_salary,
    wr.tax,
    wr.net_salary,
    w.monthly_salary,
    w.hourly_rate
FROM work_records wr
LEFT JOIN workers w ON wr.worker = w.name
ORDER BY wr.date DESC;

CREATE OR REPLACE VIEW expense_summary AS
SELECT 
    er.date,
    er.site,
    er.worker,
    er.category,
    er.amount,
    er.location,
    er.address
FROM expense_records er
ORDER BY er.date DESC;

-- 함수 생성 (자동 급여 계산)
CREATE OR REPLACE FUNCTION calculate_work_salary()
RETURNS TRIGGER AS $$
BEGIN
    -- 작업자 정보 조회
    DECLARE
        worker_record RECORD;
        calculated_salary DECIMAL(12,2) := 0;
        tax_rate DECIMAL(5,2) := 3.3;
    BEGIN
        SELECT * INTO worker_record FROM workers WHERE name = NEW.worker LIMIT 1;
        
        -- 급여 계산
        IF worker_record.hourly_rate > 0 THEN
            calculated_salary := NEW.hours * worker_record.hourly_rate;
        ELSIF worker_record.monthly_salary > 0 THEN
            calculated_salary := (worker_record.monthly_salary / 160) * NEW.hours;
        END IF;
        
        -- 세금 계산
        NEW.total_salary := calculated_salary;
        NEW.tax := calculated_salary * (tax_rate / 100);
        NEW.net_salary := calculated_salary - NEW.tax;
        
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (작업 기록 입력 시 자동 급여 계산)
CREATE TRIGGER trigger_calculate_work_salary
    BEFORE INSERT OR UPDATE ON work_records
    FOR EACH ROW
    EXECUTE FUNCTION calculate_work_salary();

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (업데이트 시간 자동 갱신)
CREATE TRIGGER trigger_update_workers_updated_at
    BEFORE UPDATE ON workers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_sites_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_work_records_updated_at
    BEFORE UPDATE ON work_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_expense_records_updated_at
    BEFORE UPDATE ON expense_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 샘플 데이터 삽입 (테스트용)
INSERT INTO workers (name, monthly_salary, hourly_rate) VALUES
('김철수', 3000000, 0),
('이영희', 0, 20000),
('박민수', 2500000, 0)
ON CONFLICT DO NOTHING;

INSERT INTO sites (name, address, manager) VALUES
('서울역 공사현장', '서울특별시 용산구 한강대로 405', '김현장'),
('강남 빌딩공사', '서울특별시 강남구 테헤란로 123', '이감독'),
('인천 항만공사', '인천광역시 중구 해안대로 1', '박책임')
ON CONFLICT DO NOTHING;

-- 테이블 정보 조회 뷰
COMMENT ON TABLE workers IS '작업자 정보 테이블';
COMMENT ON TABLE sites IS '현장 정보 테이블';
COMMENT ON TABLE work_records IS '작업 기록 테이블';
COMMENT ON TABLE expense_records IS '경비 기록 테이블';
COMMENT ON TABLE system_config IS '시스템 설정 테이블';

COMMENT ON COLUMN workers.monthly_salary IS '월 기본급 (원)';
COMMENT ON COLUMN workers.hourly_rate IS '시간당 단가 (원)';
COMMENT ON COLUMN work_records.hours IS '작업 시간 (시간)';
COMMENT ON COLUMN work_records.total_salary IS '총 급여 (원)';
COMMENT ON COLUMN work_records.tax IS '세금 (원)';
COMMENT ON COLUMN work_records.net_salary IS '실수령액 (원)';
COMMENT ON COLUMN expense_records.amount IS '경비 금액 (원)';
