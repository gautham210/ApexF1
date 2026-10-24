"""2026 entry-list metadata; FIA Monaco entry list, 5 June 2026.
https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_entry_list.pdf
Only presentation labels: never points, classifications or driver statistics.
"""
TEAM_NAMES_2026 = {
    "Mercedes": "Mercedes-AMG PETRONAS F1 Team", "Ferrari": "Scuderia Ferrari HP",
    "McLaren": "McLaren Mastercard F1 Team", "Red Bull Racing": "Oracle Red Bull Racing",
    "Williams": "Atlassian Williams F1 Team", "Racing Bulls": "Visa Cash App Racing Bulls F1 Team",
    "Aston Martin": "Aston Martin Aramco F1 Team", "Haas F1 Team": "TGR Haas F1 Team",
    "Audi": "Audi Revolut F1 Team", "Alpine": "BWT Alpine F1 Team", "Cadillac": "Cadillac Formula 1 Team",
}
NUMBERS_2026 = {"norris": "1", "max_verstappen": "3", "hadjar": "6", "lindblad": "41"}

def team_display_name(name: str, year: int) -> str:
    return TEAM_NAMES_2026.get(name, name) if year == 2026 else name
