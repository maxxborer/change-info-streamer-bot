using System;

public static class Program
{
    public static int Main()
    {
        try
        {
            ExplicitTemplatePolicy();
            WaitsForLiveThenAppliesOnce();
            NeverAppliesWhenBroadcastStaysUnavailable();
            DoesNotRetryACompletedUpdate();
            DoesNotRetryAThrowingUpdate();
            Console.WriteLine("Automatic YouTube policy tests passed (5 scenarios).");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static void ExplicitTemplatePolicy()
    {
        Assert(!AutomaticYouTubePolicy.HasExplicitTitleTemplate(null), "A missing template must not overwrite a YouTube title.");
        Assert(!AutomaticYouTubePolicy.HasExplicitTitleTemplate("   "), "A blank template must not overwrite a YouTube title.");
        Assert(AutomaticYouTubePolicy.HasExplicitTitleTemplate("Live: %subtitle%"), "An explicit template must be applied.");
    }

    private static void WaitsForLiveThenAppliesOnce()
    {
        int readinessChecks = 0;
        int waits = 0;
        int updates = 0;
        string result = AutomaticYouTubePolicy.RunWhenReady(
            () => ++readinessChecks >= 3,
            () => waits++,
            () => { updates++; return "ok"; });

        Assert(result == "ok", "The update result must be returned.");
        Assert(readinessChecks == 3 && waits == 2, "The policy must wait only until the broadcast is live.");
        Assert(updates == 1, "Metadata must be applied exactly once after readiness.");
    }

    private static void NeverAppliesWhenBroadcastStaysUnavailable()
    {
        int readinessChecks = 0;
        int waits = 0;
        int updates = 0;
        bool threw = false;
        try
        {
            AutomaticYouTubePolicy.RunWhenReady<bool>(
                () => { readinessChecks++; return false; },
                () => waits++,
                () => { updates++; return true; });
        }
        catch (InvalidOperationException)
        {
            threw = true;
        }

        Assert(threw, "An unavailable broadcast must fail after bounded readiness checks.");
        Assert(readinessChecks == AutomaticYouTubePolicy.MaxReadinessAttempts, "Readiness attempts must be bounded.");
        Assert(waits == AutomaticYouTubePolicy.MaxReadinessAttempts - 1, "There must be no wait after the final attempt.");
        Assert(updates == 0, "Metadata must not be written before the broadcast is live.");
    }

    private static void DoesNotRetryACompletedUpdate()
    {
        int updates = 0;
        bool result = AutomaticYouTubePolicy.RunWhenReady(
            () => true,
            () => throw new Exception("No wait expected."),
            () => { updates++; return false; });

        Assert(!result, "A partial platform result must be returned to the caller.");
        Assert(updates == 1, "A completed metadata update must never be retried by the readiness policy.");
    }

    private static void DoesNotRetryAThrowingUpdate()
    {
        int updates = 0;
        bool threw = false;
        try
        {
            AutomaticYouTubePolicy.RunWhenReady<bool>(
                () => true,
                () => throw new Exception("No wait expected."),
                () => { updates++; throw new InvalidOperationException("Platform update failed."); });
        }
        catch (InvalidOperationException ex)
        {
            threw = ex.Message == "Platform update failed.";
        }

        Assert(threw, "A platform update error must propagate unchanged.");
        Assert(updates == 1, "A throwing metadata update must not be retried.");
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
