import dbConnect from "@/utils/dbConn";
import { NextResponse } from "next/server";
import { findOneDocument } from "@/utils/dbUtils";
import { decrypt, decryptFile } from "@/utils/encryption";
import File from "@/models/file";

export async function POST(request: Request) {
  try {
    const res = await request.json();

    await dbConnect();
    let id = res.id;
    let password = res.password;
    let secret_key = res.secret || null;

    if (!id) {
      return NextResponse.json({ message: "No file ID provided" }, { status: 400 });
    }

    const file = await findOneDocument(File, { file_id: id });

    if (file) {
      secret_key = secret_key || file.secret;

      if (file.password) {
        if (!password) {
          return NextResponse.json({ message: "This file requires a password" }, { status: 400 });
        } else {
          const decrypted_password = await decrypt(file.password, secret_key);

          if (password !== decrypted_password) {
            return NextResponse.json({ message: "Incorrect password" }, { status: 403 });
          }
        }
      }

      await decryptFile(file.raw_file_path, secret_key); // Decryption of the file before sending the link to the user

      return NextResponse.json({
        valid: true,
        link: file.file_path,
        file_raw_path: file.raw_file_path,
        name: file.file_name,
        type: file.file_type,
        size: file.file_size,
      }, {
        status: 200,
      });

    } else {
      return NextResponse.json({
        valid: false,
        message: "No file found with this ID",
      }, {
        status: 404,
      });
    }
  } catch (err) {
    return NextResponse.json({
      valid: false,
      message: "An error occurred while retrieving the file, please check if the link is correct and try again ",
    }, {
      status: 500,
    });
  }
};