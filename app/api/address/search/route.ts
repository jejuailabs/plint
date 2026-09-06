import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('q')?.trim();
  if (!keyword || keyword.length < 2) {
    return Response.json({ results: [] });
  }

  const apiKey = process.env.JUSO_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: { code: 'CONFIG_ERROR', message: '주소 검색 API 키가 설정되지 않았습니다.' } },
      { status: 500 },
    );
  }

  const page = req.nextUrl.searchParams.get('page') ?? '1';

  const params = new URLSearchParams({
    confmKey: apiKey,
    currentPage: page,
    countPerPage: '7',
    keyword,
    resultType: 'json',
    hstryYn: 'N',
  });

  try {
    const res = await fetch(
      `https://business.juso.go.kr/addrlink/addrLinkApi.do?${params}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      return Response.json(
        { error: { code: 'UPSTREAM_ERROR', message: '주소 검색 서비스 응답 오류' } },
        { status: 502 },
      );
    }

    const json = await res.json();
    const common = json?.results?.common;

    if (common?.errorCode !== '0') {
      return Response.json({ results: [], errorMessage: common?.errorMessage });
    }

    const juso = json?.results?.juso ?? [];

    const results = juso.map((item: Record<string, string>) => ({
      roadAddress: item.roadAddr ?? '',
      jibunAddress: item.jibunAddr ?? '',
      zipCode: item.zipNo ?? '',
      buildingName: item.bdNm ?? '',
      siNm: item.siNm ?? '',
      sggNm: item.sggNm ?? '',
      emdNm: item.emdNm ?? '',
      admCd: item.admCd ?? '',
      rnMgtSn: item.rnMgtSn ?? '',
      bdMgtSn: item.bdMgtSn ?? '',
    }));

    return Response.json({
      results,
      totalCount: Number(common?.totalCount ?? 0),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return Response.json(
        { error: { code: 'TIMEOUT', message: '주소 검색 시간 초과' } },
        { status: 504 },
      );
    }
    return Response.json(
      { error: { code: 'NETWORK_ERROR', message: '주소 검색 중 오류 발생' } },
      { status: 500 },
    );
  }
}
