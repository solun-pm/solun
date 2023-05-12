import dbConnect from "@/utils/dbConn";
import { NextResponse } from "next/server";
import { findOneDocument } from "@/utils/dbUtils";
import { decrypt } from "@/utils/encryption";
import Message from "@/models/message";

export async function POST(request: Request) {
  try {
    const res = await request.json();

    await dbConnect();
    let id = res.id;
    let password = res.password;
    let secret_key = res.secret || null;

    if (!id) {
      return NextResponse.json({ message: "No message ID provided" }, { status: 400 });
    }

    const message = await findOneDocument(Message, { message_id: id });

    if (message) {
      secret_key = secret_key || message.secret;

      if (message.password) {
        if (!password) {
          return NextResponse.json({ message: "This message requires a password" }, { status: 400 });
        } else {
          const decrypted_password = await decrypt(message.password, secret_key);

          if (password !== decrypted_password) {
            return NextResponse.json({ message: "Incorrect password" }, { status: 403 });
          }
        }
      }

      const decrypted_message = await decrypt(message.message, secret_key);
      return NextResponse.json({
        valid: true,
        message: decrypted_message,
      }, {
        status: 200,
      });

    } else {
      return NextResponse.json({
        valid: false,
        message: "No message found with this ID",
      }, {
        status: 404,
      });
    }
  } catch (err) {
    return NextResponse.json({
      valid: false,
      message: "An error occurred while retrieving the message, please check if the link is correct and try again",
    }, {
      status: 500,
    });
  }
};