import { NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/authorize";
import { assertSameOrigin, fail, ok, parseBody } from "@/lib/http";
import { replyToInquiry } from "@/lib/inquiries/service";
import { inquiryMessageSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const input = await parseBody(request, inquiryMessageSchema);
    const row = await replyToInquiry(actor, (await params).id, input.body);
    return ok({ id: row.id, message: "Reply sent" }, 201);
  } catch (error) {
    return fail(error);
  }
}
