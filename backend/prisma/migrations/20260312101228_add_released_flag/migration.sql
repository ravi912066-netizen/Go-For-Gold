-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "courseId" INTEGER NOT NULL,
    "startTime" DATETIME,
    "deadline" DATETIME,
    "difficulty" TEXT,
    "tags" TEXT,
    "externalUrl" TEXT,
    "isProctored" BOOLEAN NOT NULL DEFAULT false,
    "isReleased" BOOLEAN NOT NULL DEFAULT true,
    "reward" TEXT DEFAULT '100 XP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("courseId", "createdAt", "deadline", "description", "difficulty", "externalUrl", "id", "isProctored", "startTime", "tags", "title") SELECT "courseId", "createdAt", "deadline", "description", "difficulty", "externalUrl", "id", "isProctored", "startTime", "tags", "title" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "timeLimit" INTEGER NOT NULL DEFAULT 2,
    "memoryLimit" INTEGER NOT NULL DEFAULT 256,
    "starterCode" TEXT,
    "testcases" TEXT NOT NULL,
    "isQotd" BOOLEAN NOT NULL DEFAULT false,
    "qotdDate" DATETIME,
    "deadline" DATETIME,
    "courseId" INTEGER,
    "isReleased" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("courseId", "createdAt", "deadline", "difficulty", "id", "isQotd", "memoryLimit", "qotdDate", "slug", "starterCode", "statement", "tags", "testcases", "timeLimit", "title") SELECT "courseId", "createdAt", "deadline", "difficulty", "id", "isQotd", "memoryLimit", "qotdDate", "slug", "starterCode", "statement", "tags", "testcases", "timeLimit", "title" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE UNIQUE INDEX "Question_slug_key" ON "Question"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
