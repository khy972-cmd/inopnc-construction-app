-- sites 테이블에 status 컬럼 추가
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS status text DEFAULT '';

-- 기존 데이터의 status를 빈 문자열로 초기화
UPDATE public.sites SET status = '' WHERE status IS NULL;

-- status 컬럼이 제대로 추가되었는지 확인
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sites' 
  AND column_name = 'status';

