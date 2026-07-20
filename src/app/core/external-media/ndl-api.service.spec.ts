import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NdlApiService } from './ndl-api.service';

function buildSruResponse(records: { title: string; volume: string; isbn: string }[]): string {
  const recordXml = records
    .map(
      (r) => `
    <record>
      <recordData>
        &lt;rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcndl="http://ndl.go.jp/dcndl/terms/"&gt;
          &lt;dcndl:BibResource rdf:about="https://example.com/${r.isbn}"&gt;
            &lt;dcterms:identifier rdf:datatype="http://ndl.go.jp/dcndl/terms/ISBN"&gt;${r.isbn}&lt;/dcterms:identifier&gt;
            &lt;dcterms:title&gt;${r.title}. ${r.volume}&lt;/dcterms:title&gt;
            &lt;dc:title&gt;&lt;rdf:Description&gt;
              &lt;rdf:value&gt;${r.title}&lt;/rdf:value&gt;
            &lt;/rdf:Description&gt;&lt;/dc:title&gt;
            &lt;dcndl:volume&gt;&lt;rdf:Description&gt;
              &lt;rdf:value&gt;[${r.volume}]&lt;/rdf:value&gt;
              &lt;dcndl:transcription&gt;${r.volume}&lt;/dcndl:transcription&gt;
            &lt;/rdf:Description&gt;&lt;/dcndl:volume&gt;
          &lt;/dcndl:BibResource&gt;
        &lt;/rdf:RDF&gt;
      </recordData>
    </record>`,
    )
    .join('');
  return `<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/"><records>${recordXml}</records></searchRetrieveResponse>`;
}

describe('NdlApiService', () => {
  let service: NdlApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NdlApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('巻番号一覧を渡すと1リクエストでまとめてISBNを取得する', () => {
    let result: unknown;
    service.searchIsbnsForVolumes('ブルーロック', [12, 13]).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.startsWith('https://ndlsearch.ndl.go.jp/api/sru'));
    req.flush(
      buildSruResponse([
        { title: 'ブルーロック', volume: '12', isbn: '978-4-06-500012-0' },
        { title: 'ブルーロック', volume: '13', isbn: '978-4-06-500013-7' },
        { title: 'ブルーロック', volume: '14', isbn: '978-4-06-500014-4' },
      ]),
    );

    expect(result).toEqual(
      new Map([
        [12, '9784065000120'],
        [13, '9784065000137'],
      ]),
    );
  });

  it('巻番号が空配列ならリクエストせず空Mapを返す', () => {
    let result: unknown;
    service.searchIsbnsForVolumes('ブルーロック', []).subscribe((r) => (result = r));

    httpMock.expectNone(() => true);
    expect(result).toEqual(new Map());
  });

  it('dcndl:transcriptionが全角数字でも巻数を照合できる', () => {
    let result: unknown;
    service.searchIsbnsForVolumes('ブルーロック', [13]).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.startsWith('https://ndlsearch.ndl.go.jp/api/sru'));
    req.flush(
      buildSruResponse([{ title: 'ブルーロック', volume: '１３', isbn: '978-4-06-500013-7' }]),
    );

    expect(result).toEqual(new Map([[13, '9784065000137']]));
  });

  it('シリーズタイトルに一致しないレコードは無視する', () => {
    let result: unknown;
    service.searchIsbnsForVolumes('ブルーロック', [1]).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.startsWith('https://ndlsearch.ndl.go.jp/api/sru'));
    req.flush(buildSruResponse([{ title: '無関係な作品', volume: '1', isbn: '978-4-00-000000-1' }]));

    expect(result).toEqual(new Map());
  });

  it('要求した巻が見つからなければ該当分だけ欠けたMapを返す', () => {
    let result: unknown;
    service.searchIsbnsForVolumes('ブルーロック', [1, 99]).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.startsWith('https://ndlsearch.ndl.go.jp/api/sru'));
    req.flush(buildSruResponse([{ title: 'ブルーロック', volume: '1', isbn: '978-4-06-500001-4' }]));

    expect(result).toEqual(new Map([[1, '9784065000014']]));
  });

  it('通信エラー時は例外を投げず空Mapを返す', () => {
    vi.useFakeTimers();
    let result: unknown;
    let errored = false;
    service.searchIsbnsForVolumes('ブルーロック', [1]).subscribe({
      next: (r) => (result = r),
      error: () => (errored = true),
    });

    for (let i = 0; i < 3; i++) {
      const req = httpMock.expectOne((r) => r.url.startsWith('https://ndlsearch.ndl.go.jp/api/sru'));
      req.error(new ProgressEvent('error'));
      vi.advanceTimersByTime(1000);
    }

    expect(errored).toBe(false);
    expect(result).toEqual(new Map());
    vi.useRealTimers();
  });
});
