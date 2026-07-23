import { NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/authorize";
import { InquiryStatus } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { createInquiry, listInquiries, serializeInquiry } from "@/lib/inquiries/service";
import { createInquirySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const actor = await apiUser(request);
    const raw = request.nextUrl.searchParams.get("status");
    if (raw && !Object.values(InquiryStatus).includes(raw as InquiryStatus))
      throw new HttpError(422, "Invalid inquiry status");
    const status = raw as InquiryStatus | null;
    const parseDate = (name: string) => {
      const value = request.nextUrl.searchParams.get(name);
      if (!value) return undefined;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new HttpError(422, `Invalid ${name} date`);
      return date;
    };
    const before = parseDate("cursor") ?? parseDate("before");
    const after = parseDate("after");
    return ok((await listInquiries(actor, status ?? undefined, before, after)).map(serializeInquiry));
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const input = await parseBody(request, createInquirySchema);
    const inquiry = await createInquiry(actor, input);
    return ok({ id: inquiry.id, status: inquiry.status, message: "Inquiry created" }, 201);
  } catch (error) {
    return fail(error);
  }
}
