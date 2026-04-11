import { NextResponse } from 'next/server'

export async function GET() {
  const phone = process.env.TWILIO_PHONE_NUMBER || ''

  const vcard = `BEGIN:VCARD
VERSION:3.0
FN:RxNudge
TEL;TYPE=CELL:${phone}
END:VCARD`

  return new NextResponse(vcard, {
    headers: {
      'Content-Type': 'text/vcard',
      'Content-Disposition': 'attachment; filename="RxNudge.vcf"',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
