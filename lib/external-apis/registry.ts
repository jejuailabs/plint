import type { ConnectorManifest } from '@/lib/external-apis/connector';

export const connectorRegistry = [
  {
    id: 'juso-coordinate', label: '주소·좌표', provider: '도로명주소', datasetId: 'juso-coordinate',
    sourceUrl: 'https://business.juso.go.kr/addrlink/openApi/searchApi.do', protocol: 'REST', auth: 'serviceKey', path: 'request',
    updateCycle: 'daily', timeoutMs: 5000, licenseCode: 'official-api-review', commercialUse: 'review', derivativeUse: 'review',
    coordinateSystem: 'GRS80 UTM-K', requiredForPreview: true,
  },
  {
    id: 'continuous-cadastral', label: '연속지적도', provider: '국토교통부', datasetId: '15056910',
    sourceUrl: 'https://www.data.go.kr/data/15056910/openapi.do', protocol: 'WFS', auth: 'serviceKey', path: 'warehouse',
    updateCycle: 'provider-defined', timeoutMs: 8000, licenseCode: 'public-data-unrestricted', commercialUse: 'allowed', derivativeUse: 'allowed',
    coordinateSystem: 'source-defined', requiredForPreview: true,
  },
  {
    id: 'land-use-plan', label: '토지이용계획', provider: '국토교통부', datasetId: '15045900',
    sourceUrl: 'https://www.data.go.kr/data/15045900/fileData.do', protocol: 'FILE', auth: 'none', path: 'warehouse',
    updateCycle: 'quarterly', timeoutMs: 8000, licenseCode: 'public-data-unrestricted', commercialUse: 'allowed', derivativeUse: 'allowed',
    requiredForPreview: true,
  },
  {
    id: 'building-ledger', label: '건축물대장', provider: '건축HUB', datasetId: '15134735',
    sourceUrl: 'https://www.data.go.kr/data/15134735/openapi.do', protocol: 'REST', auth: 'serviceKey', path: 'request',
    updateCycle: 'provider-defined', timeoutMs: 8000, dailyQuota: 10000, licenseCode: 'public-data-unrestricted', commercialUse: 'allowed', derivativeUse: 'allowed',
    requiredForPreview: true,
  },
  {
    id: 'gis-building', label: 'GIS 건물통합', provider: '국토교통부', datasetId: '15083092',
    sourceUrl: 'https://www.data.go.kr/data/15083092/fileData.do', protocol: 'FILE', auth: 'none', path: 'warehouse',
    updateCycle: 'monthly', timeoutMs: 8000, licenseCode: 'public-data-unrestricted', commercialUse: 'allowed', derivativeUse: 'allowed',
    requiredForPreview: true,
  },
  {
    id: 'land-characteristics', label: '토지특성', provider: '국토교통부', datasetId: '15123549',
    sourceUrl: 'https://www.data.go.kr/data/15123549/openapi.do', protocol: 'WFS', auth: 'serviceKey', path: 'warehouse',
    updateCycle: 'provider-defined', timeoutMs: 8000, licenseCode: 'public-data-unrestricted', commercialUse: 'allowed', derivativeUse: 'allowed',
    requiredForPreview: true,
  },
  {
    id: 'land-transactions', label: '토지 실거래', provider: '국토교통부', datasetId: '15126466',
    sourceUrl: 'https://www.data.go.kr/data/15126466/openapi.do', protocol: 'REST', auth: 'serviceKey', path: 'request',
    updateCycle: 'daily', timeoutMs: 8000, licenseCode: 'public-data-unrestricted', commercialUse: 'allowed', derivativeUse: 'allowed',
    requiredForPreview: true,
  },
  {
    id: 'asos-daily', label: '기상·일사', provider: '기상청', datasetId: '15059093',
    sourceUrl: 'https://www.data.go.kr/data/15059093/openapi.do', protocol: 'REST', auth: 'serviceKey', path: 'request',
    updateCycle: 'daily', timeoutMs: 8000, dailyQuota: 10000, licenseCode: 'attribution-third-party', commercialUse: 'review', derivativeUse: 'review',
    requiredForPreview: false,
  },
  {
    id: 'sgis-census', label: '인구·가구·사업체', provider: '통계청 SGIS', datasetId: 'sgis-openapi',
    sourceUrl: 'https://sgis.kostat.go.kr/developer/html/openApi/api/intro.html', protocol: 'REST', auth: 'token', path: 'request',
    updateCycle: 'annual', timeoutMs: 8000, dailyQuota: 50000, licenseCode: 'commercial-key-approval', commercialUse: 'review', derivativeUse: 'review',
    requiredForPreview: false,
  },
  {
    id: 'urban-flood', label: '도시침수', provider: '한강홍수통제소', datasetId: '15141734',
    sourceUrl: 'https://www.data.go.kr/data/15141734/openapi.do', protocol: 'WMS', auth: 'serviceKey', path: 'warehouse',
    updateCycle: 'provider-defined', timeoutMs: 8000, licenseCode: 'kogl-type-4', commercialUse: 'restricted', derivativeUse: 'restricted',
    requiredForPreview: false,
  },
  {
    id: 'heritage-spatial', label: '국가유산 공간규제', provider: '국가유산청', datasetId: '3070426',
    sourceUrl: 'https://www.data.go.kr/dataset/3070426/openapi.do', protocol: 'WFS', auth: 'serviceKey', path: 'warehouse',
    updateCycle: 'provider-defined', timeoutMs: 8000, licenseCode: 'provider-defined', commercialUse: 'review', derivativeUse: 'review',
    requiredForPreview: false,
  },
] satisfies ConnectorManifest[];

export function getConnectorManifest(id: string) {
  return connectorRegistry.find((connector) => connector.id === id);
}
