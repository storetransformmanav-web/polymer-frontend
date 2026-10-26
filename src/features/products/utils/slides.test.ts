import { describe, expect, it } from 'vitest'
import { fileNameOf, fileTypeOf, toSlides } from './slides.ts'

describe('fileNameOf', () => {
  it('takes the file name from the address, without the query', () => {
    expect(
      fileNameOf(
        'https://cdn.shopify.com/s/files/1/0543/files/photo-1584917865442-de89df76afd3.jpg?v=1792401867',
      ),
    ).toBe('photo-1584917865442-de89df76afd3.jpg')
    expect(fileNameOf('https://cdn.example.com/a%20b.png')).toBe('a b.png')
  })

  it('gives nothing for an address that is not one', () => {
    expect(fileNameOf('not a url')).toBe('')
    expect(fileNameOf('https://cdn.example.com/')).toBe('')
  })
})

describe('fileTypeOf', () => {
  it('names the type from the mime type', () => {
    expect(fileTypeOf('image/jpeg', 'IMAGE')).toBe('JPG')
    expect(fileTypeOf('image/png', 'IMAGE')).toBe('PNG')
    expect(fileTypeOf('image/svg+xml', null)).toBe('SVG')
    expect(fileTypeOf('video/mp4', 'VIDEO')).toBe('MP4')
  })

  it('falls back to the media type, then to nothing', () => {
    expect(fileTypeOf(null, 'IMAGE')).toBe('Image')
    expect(fileTypeOf(undefined, undefined)).toBe('')
  })
})

describe('toSlides', () => {
  it('carries the image record: id, alt text, size, file name and type', () => {
    const [slide] = toSlides(
      [
        {
          id: '33cf17ee-c15f-4d7a-b78a-2085a945922c',
          url: 'https://cdn.shopify.com/files/photo-1.jpg?v=1',
          alt_text: 'Small white plastic carrier bag 1',
          width: 500,
          height: 667,
          position: 0,
          media_type: 'IMAGE',
          mime_type: 'image/jpeg',
        },
      ],
      'Bag',
    )

    expect(slide).toMatchObject({
      id: '33cf17ee-c15f-4d7a-b78a-2085a945922c',
      altText: 'Small white plastic carrier bag 1',
      width: 500,
      height: 667,
      fileName: 'photo-1.jpg',
      fileType: 'JPG',
    })
  })

  it('leaves out an image whose address is not http(s)', () => {
    expect(toSlides([{ id: 'x', url: 'javascript:alert(1)' }], 'Bag')).toEqual([])
  })
})
