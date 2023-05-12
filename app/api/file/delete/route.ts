import dbConnect from "@/utils/dbConn";
import { NextResponse } from "next/server";
import { findOneDocument, deleteOneDocument } from "@/utils/dbUtils";
import { encryptFile } from "@/utils/encryption";
import File from "@/models/file";

export async function POST(request: Request) {
  try {
    const res = await request.json();

    await dbConnect();
    let id = res.id;
    let secret_key = res.secret || null;

    if (!id) {
      return NextResponse.json({ message: "No file ID provided" }, { status: 400 });
    }

    const file = await findOneDocument(File, { file_id: id });

    if ( file ) {
      secret_key = secret_key || file.secret;
      const file_path = file.raw_file_path;

      const deletionMode = file.auto_delete;
    
      if (deletionMode === 'download'){
        await deleteOneDocument(File, { file_id: id });
        return NextResponse.json({ message: "File deleted successfully" }, { status: 200 });
      } else if (deletionMode === 'never') {
        await encryptFile(file_path, secret_key);
        return NextResponse.json({ message: "Auto Deletion is disabled for this file, it will never be deleted" }, { status: 200 });
      } else {
        const deletionTimes = {
          '1d': 1 * 24 * 60 * 60 * 1000,
          '1w': 7 * 24 * 60 * 60 * 1000,
          '1m': 30 * 24 * 60 * 60 * 1000,
          '3m': 3 * 30 * 24 * 60 * 60 * 1000,
          '6m': 6 * 30 * 24 * 60 * 60 * 1000,
          '1y': 365 * 24 * 60 * 60 * 1000,
        };

        if (file.auto_delete in deletionTimes) {
          const createdAtTimestamp = new Date(file.createdAt).getTime();
          // @ts-ignore - TS doesn't know that auto_delete is a key of deletionTimes
          const deletionTime = createdAtTimestamp + deletionTimes[file.auto_delete];
          const remainingTimeMs = deletionTime - Date.now();
          const remainingTimeSeconds = Math.floor(remainingTimeMs / 1000);
          const remainingTimeMinutes = Math.floor(remainingTimeSeconds / 60);
          const remainingTimeHours = Math.floor(remainingTimeMinutes / 60);
          const remainingTimeDays = Math.floor(remainingTimeHours / 24);
          
          const remainingSeconds = remainingTimeSeconds % 60;
          const remainingMinutes = remainingTimeMinutes % 60;
          const remainingHours = remainingTimeHours % 24;
          const remainingDays = remainingTimeDays;
          
          let timeString = '';
          if (remainingDays > 0) {
            timeString += `${remainingDays} days, `;
          }
          if (remainingHours > 0) {
            timeString += `${remainingHours} hours, `;
          }
          if (remainingMinutes > 0) {
            timeString += `${remainingMinutes} minutes, `;
          }
          if (remainingSeconds > 0) {
            timeString += `${remainingSeconds} seconds`;
          }
          
          await encryptFile(file_path, secret_key);
          return NextResponse.json({ message: "File will be deleted in " + timeString }, { status: 200 });
        } else {
          await deleteOneDocument(File, { file_id: id });
          return NextResponse.json({ message: "File deleted successfully" }, { status: 200 });
        }        
      }
    }
  } catch (err) {
    return NextResponse.json(
      {
        message: "An error occurred while deleting the message, please try again" + err,
      },
      {
        status: 500,
      }
    );
  }
};