*** Classroom.jsx — class roles, permissions, and aggregate progress ***

1) Replace classRoleLabel():

function classRoleLabel(role) {
  if (role === "owner") return "Primary Teacher";
  if (role === "admin") return "Teacher";
  if (role === "moderator") return "Aide";
  return "Student";
}

2) Replace the current role flags:

  const myRole = group?.membership?.role || "member";
  const isTeacher = ["owner", "admin"].includes(myRole);
  const isOwner = myRole === "owner";

with:

  const myRole = group?.membership?.role || "member";

  // Classroom teaching permissions:
  // owner = Primary Teacher
  // admin = Teacher
  // moderator = Aide
  // member = Student
  const canTeach = ["owner", "admin", "moderator"].includes(myRole);
  const canManageClass = ["owner", "admin"].includes(myRole);
  const isOwner = myRole === "owner";

3) Add these state values beside the existing progress state:

  const [classStudentProgress, setClassStudentProgress] = useState([]);
  const [myClassProgress, setMyClassProgress] = useState({
    percent: 0,
    completed: 0,
    total: 0
  });

4) In refreshCore(), REMOVE the entire block that converts class `moderator`
members to `member`.

Delete this behavior completely:

    /*
     * Classes have only Primary Teacher / Teacher / Student.
     * If an older class still contains the group-only Moderator role,
     * the Primary Teacher normalizes it to Student.
     */
    if (
      isOwner &&
      loadedMembers.some((member) => member.role === "moderator")
    ) {
      ...
    }

Then set members directly:

    setMembers(loadedMembers);

Also change:

    if (isTeacher) {

to:

    if (canTeach) {

5) Replace the selected-assignment teacher progress effect condition:

    if (!isTeacher || !selectedAssignment) {

with:

    if (!canTeach || !selectedAssignment) {

and replace `isTeacher` with `canTeach` in that effect dependency list.

6) Replace the student progress effect condition:

    if (isTeacher || !assignments.length) {

with:

    if (canTeach || !assignments.length) {

and replace `isTeacher` with `canTeach` in the dependency list.

7) Add this aggregate class-progress effect after the existing assignment
progress effects:

  useEffect(() => {
    let active = true;

    async function loadClassProgress() {
      if (!assignments.length) {
        if (active) {
          setClassStudentProgress([]);
          setMyClassProgress({
            percent: 0,
            completed: 0,
            total: 0
          });
        }
        return;
      }

      try {
        setProgressLoading(true);

        if (canTeach) {
          const assignmentRows = await Promise.all(
            assignments.map((assignment) =>
              getClassAssignmentProgress(
                groupId,
                members,
                assignment
              )
            )
          );

          const students = members.filter(
            (member) =>
              !["owner", "admin", "moderator"].includes(member.role)
          );

          const aggregated = students.map((student) => {
            const perAssignment = assignmentRows.map((rows) => {
              const row = rows.find(
                (item) =>
                  String(item.userId) === String(student.userId)
              );

              return Number(row?.assignmentPercent) || 0;
            });

            const completed = perAssignment.filter(
              (value) => value >= 100
            ).length;

            const percent = assignments.length
              ? Math.round(
                  perAssignment.reduce(
                    (sum, value) => sum + value,
                    0
                  ) / assignments.length
                )
              : 0;

            return {
              ...student,
              classPercent: percent,
              assignmentsCompleted: completed,
              assignmentsTotal: assignments.length
            };
          });

          if (active) {
            setClassStudentProgress(aggregated);
          }

          return;
        }

        const progressByAssignment =
          await getMyClassAssignmentProgress(
            groupId,
            assignments
          );

        const percentages = assignments.map((assignment) => {
          const progress = progressByAssignment?.[assignment.id];
          return Number(progress?.assignmentPercent) || 0;
        });

        const completed = percentages.filter(
          (value) => value >= 100
        ).length;

        const percent = assignments.length
          ? Math.round(
              percentages.reduce(
                (sum, value) => sum + value,
                0
              ) / assignments.length
            )
          : 0;

        if (active) {
          setMyClassProgress({
            percent,
            completed,
            total: assignments.length
          });
        }
      } catch (error) {
        console.error(
          "Could not load aggregate class progress:",
          error
        );

        if (active) {
          setStatus(
            error?.message ||
              "We couldn't load class progress."
          );
        }
      } finally {
        if (active) {
          setProgressLoading(false);
        }
      }
    }

    loadClassProgress();

    return () => {
      active = false;
    };
  }, [
    groupId,
    assignments,
    members,
    canTeach
  ]);

8) Replace student/teacher counts:

  const studentCount = members.filter(
    (member) => !["owner", "admin"].includes(member.role)
  ).length;

  const teacherCount = members.length - studentCount;

with:

  const studentCount = members.filter(
    (member) =>
      !["owner", "admin", "moderator"].includes(member.role)
  ).length;

  const teacherCount = members.filter(
    (member) => ["owner", "admin"].includes(member.role)
  ).length;

  const aideCount = members.filter(
    (member) => member.role === "moderator"
  ).length;

9) In saveAssignment(), add this guard at the top:

    if (!canTeach) {
      setStatus(
        "Only teachers and aides can create or edit assignments."
      );
      return;
    }

10) In createTopic(), add this guard at the top:

    if (!canTeach) {
      setStatus(
        "Only teachers and aides can start a class discussion."
      );
      return;
    }

Students should still be able to reply to discussions.

11) Replace changeClassRole() role mapping:

      const storedRole =
        nextRole === "teacher"
          ? "admin"
          : "member";

with:

      const storedRole =
        nextRole === "teacher"
          ? "admin"
          : nextRole === "aide"
            ? "moderator"
            : "member";

12) Update the tabs:

  const tabs = [
    ["assignments", "Assignments"],
    ["discussion", "Discussion"],
    ["students", canTeach ? "Students" : "Classmates"],
    ...(canManageClass ? [["settings", "Settings"]] : [])
  ];

13) In the hero chip row add an aide chip after the teacher chip:

            {aideCount > 0 && (
              <span className="chip">
                <Users size={13} /> {aideCount}{" "}
                {aideCount === 1 ? "aide" : "aides"}
              </span>
            )}

14) Add the student's aggregate class progress near the top of the
Assignments section, BEFORE the assignment list:

            {!canTeach && (
              <div
                style={{
                  margin: "1rem 0 1.25rem",
                  padding: "1rem",
                  border: "1px solid var(--line)",
                  borderRadius: 18
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    alignItems: "center",
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <p className="eyebrow">Class Progress</p>
                    <h3 style={{ marginBottom: "0.25rem" }}>
                      {myClassProgress.percent}% complete
                    </h3>
                    <small className="muted">
                      {myClassProgress.completed} of{" "}
                      {myClassProgress.total} assignments complete
                    </small>
                  </div>

                  <ProgressBar value={myClassProgress.percent} />
                </div>
              </div>
            )}

15) Replace assignment creation/edit visibility checks from `isTeacher`
to `canTeach`, including:

  {isTeacher && ( ... Assign Reading ... )}
  {showCreate && isTeacher && ( ... )}

becomes:

  {canTeach && ( ... )}
  {showCreate && canTeach && ( ... )}

16) The Discussion creation form must ONLY render for teachers/aides.

Replace the always-visible discussion form with:

            {canTeach && (
              <form
                className="stack-md"
                onSubmit={createTopic}
                style={{ marginBottom: "1.25rem" }}
              >
                ...existing title input...
                ...existing textarea...
                ...existing Post Discussion button...
              </form>
            )}

Directly below it add:

            {!canTeach && (
              <p className="muted" style={{ marginBottom: "1.25rem" }}>
                Teachers and aides can start discussions. Students can
                participate by replying below.
              </p>
            )}

17) For discussion moderation, replace:

  {(post.canDelete || isTeacher) && (

with:

  {(post.canDelete || canTeach) && (

and replace the same `isTeacher` check on reply deletion with `canTeach`.

18) Update roster headings:

            <p className="eyebrow">
              {canTeach ? "Class Roster" : "Classmates"}
            </p>
            <h2>
              {canTeach
                ? "Students, Aides & Teachers"
                : "Classmates"}
            </h2>

19) Update the owner role select to include Aide.

Replace the select value expression with:

                          value={
                            member.role === "admin"
                              ? "teacher"
                              : member.role === "moderator"
                                ? "aide"
                                : "student"
                          }

and add:

                          <option value="aide">
                            Aide
                          </option>

between Student and Teacher.

20) Change the invite section check from:

  {isTeacher && inviteableFriends.length > 0 && (

to:

  {canTeach && inviteableFriends.length > 0 && (

21) Settings must remain Teacher-level, not Aide-level.

Replace:

  {activeTab === "settings" && isTeacher && (

with:

  {activeTab === "settings" && canManageClass && (

22) Add aggregate student progress to the roster for teachers/aides.
Inside each roster member row, after the role label, show this only for
actual students:

                  {canTeach &&
                    !["owner", "admin", "moderator"].includes(
                      member.role
                    ) && (() => {
                      const classProgress =
                        classStudentProgress.find(
                          (item) =>
                            String(item.userId) ===
                            String(member.userId)
                        );

                      if (!classProgress) return null;

                      return (
                        <div
                          style={{
                            minWidth: 190,
                            flex: "1 1 220px"
                          }}
                        >
                          <ProgressBar
                            value={classProgress.classPercent}
                          />
                          <small className="muted">
                            {classProgress.classPercent}% ·{" "}
                            {classProgress.assignmentsCompleted} of{" "}
                            {classProgress.assignmentsTotal} assignments
                          </small>
                        </div>
                      );
                    })()}

This is the class-wide progress requested: aggregate progress across all
assignments in this class, not across all classes.
